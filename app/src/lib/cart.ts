import { applyPercent, shippingFor, vatIncludedIn } from '@/lib/money';
import { MAX_QUANTITY_PER_LINE } from '@/lib/cart-constants';
import {
  EPHEMERAL_CART_ID,
  claimCart,
  deleteCartItem,
  deleteCartItems,
  findCart,
  findCartItems,
  insertCart,
  setCartCoupon,
  setCartItemQuantity,
  upsertCartItem,
} from '@/lib/repositories/carts';
import type { CartRow } from '@/lib/repositories/carts';
import { findCoupon } from '@/lib/repositories/coupons';
import { categoriesForProducts, findProductById } from '@/lib/repositories/products';
import type { Cart, CartItem, CartTotals, Coupon } from '@/lib/types';

export { MAX_QUANTITY_PER_LINE };
export { findCoupon };

/**
 * Cart pricing and mutation.
 *
 * The arithmetic below is deliberately synchronous and pure: every function that
 * computes an amount takes the coupon and the per-line categories as arguments
 * instead of fetching them. Only the thin async wrappers at the bottom touch the
 * database. Keeping the split means a rounding rule can be read, and reasoned
 * about, without a database in the picture.
 *
 * `categories` maps productId → category slug, loaded once per recalculation by
 * `pricingInputs()`.
 */

/**
 * One deliberately seeded defect, gated behind SEED_BUGS=1.
 * See docs/bug-reports/BUG-001-coupon-rounding.md — percentage discounts are
 * truncated to whole euros, so the amount deducted does not match the announced
 * percentage on any cart whose subtotal is not a round number of euros.
 */
const COUPON_ROUNDING_BUG_ENABLED = process.env.SEED_BUGS === '1';

export type Categories = Map<string, string>;

export function emptyTotals(): CartTotals {
  return { subtotal: 0, discount: 0, shipping: 0, vat: 0, total: 0, itemCount: 0 };
}

/**
 * A cart that exists only for the duration of the response.
 *
 * Handed to visitors who have not put anything in a basket yet. It carries the
 * nil uuid, so any query it is passed to matches nothing rather than failing —
 * see EPHEMERAL_CART_ID.
 */
export function emptyCart(): Cart {
  return {
    id: EPHEMERAL_CART_ID,
    userId: null,
    items: [],
    couponCode: null,
    totals: emptyTotals(),
    updatedAt: new Date().toISOString(),
  };
}

export type CouponRejection =
  | { ok: true; coupon: Coupon }
  | { ok: false; reason: 'unknown' | 'expired' | 'min_subtotal' | 'category'; coupon?: Coupon };

/* -------------------------------------------------------------------------- */
/* Pure pricing                                                               */
/* -------------------------------------------------------------------------- */

/** Subtotal the coupon actually applies to — the whole cart, or one category. */
function eligibleSubtotal(items: CartItem[], coupon: Coupon, categories: Categories): number {
  if (!coupon.category) {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }
  return items.reduce(
    (sum, item) =>
      categories.get(item.productId) === coupon.category ? sum + item.lineTotal : sum,
    0,
  );
}

export function evaluateCouponWith(
  coupon: Coupon | undefined,
  items: CartItem[],
  categories: Categories,
): CouponRejection {
  if (!coupon) return { ok: false, reason: 'unknown' };

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { ok: false, reason: 'expired', coupon };
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, reason: 'min_subtotal', coupon };
  }

  if (coupon.category && eligibleSubtotal(items, coupon, categories) === 0) {
    return { ok: false, reason: 'category', coupon };
  }

  return { ok: true, coupon };
}

export function discountFor(
  items: CartItem[],
  coupon: Coupon | undefined,
  categories: Categories,
): number {
  if (!coupon) return 0;
  const base = eligibleSubtotal(items, coupon, categories);
  // Stryker disable next-line ConditionalExpression: mutant équivalent pour tout
  // coupon que le domaine produit. Sur une base nulle, `applyPercent(0, v)` rend
  // 0 et `Math.min(v, 0)` rend 0 dès que `v` est positif — ce que sont toutes
  // les valeurs semées. Le tuer demanderait un coupon à valeur négative, cas où
  // ce garde ne suffirait de toute façon pas (`Math.min` le laisserait passer
  // sur une base non nulle).
  if (base === 0) return 0;

  if (coupon.type === 'percent') {
    if (COUPON_ROUNDING_BUG_ENABLED) {
      return Math.floor((base * coupon.value) / 100 / 100) * 100;
    }
    return applyPercent(base, coupon.value);
  }
  return Math.min(coupon.value, base);
}

export function computeTotals(
  items: CartItem[],
  coupon: Coupon | undefined,
  categories: Categories,
): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const evaluated = coupon ? evaluateCouponWith(coupon, items, categories) : undefined;
  const discount = evaluated?.ok ? discountFor(items, coupon, categories) : 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = shippingFor(afterDiscount);
  const total = afterDiscount + shipping;

  return {
    subtotal,
    discount,
    shipping,
    vat: vatIncludedIn(total),
    total,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Loads everything the pricing needs, in as few queries as possible: the coupon,
 * and the categories of the lines — and the categories only when a
 * category-restricted coupon is actually in play.
 */
export async function pricingInputs(
  items: CartItem[],
  couponCode: string | null,
): Promise<{ coupon: Coupon | undefined; categories: Categories }> {
  const coupon = couponCode ? await findCoupon(couponCode) : undefined;
  const categories = coupon?.category
    ? await categoriesForProducts([...new Set(items.map((item) => item.productId))])
    : new Map<string, string>();
  return { coupon, categories };
}

/** Async facade kept for callers that only have a code — validation endpoints. */
export async function evaluateCoupon(code: string, items: CartItem[]): Promise<CouponRejection> {
  const { coupon, categories } = await pricingInputs(items, code);
  return evaluateCouponWith(coupon, items, categories);
}

/* -------------------------------------------------------------------------- */
/* Cart mutation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Reads a cart back and prices it.
 *
 * `totals` is computed here rather than stored, and an expired or no-longer-
 * eligible coupon is dropped — persistently, not just in the returned object.
 * A coupon can stop applying because the cart changed under it (a quantity
 * lowered below the minimum), so it is re-evaluated on every read instead of
 * only at the moment it was keyed in.
 */
async function hydrate(row: CartRow): Promise<Cart> {
  const items = await findCartItems(row.id);
  const { coupon, categories } = await pricingInputs(items, row.couponCode);
  const applied = coupon && evaluateCouponWith(coupon, items, categories).ok ? coupon : undefined;

  if (row.couponCode && !applied) await setCartCoupon(row.id, null);

  return {
    id: row.id,
    userId: row.userId,
    items,
    couponCode: applied ? row.couponCode : null,
    totals: computeTotals(items, applied, categories),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Re-reads and re-prices a cart after a mutation. */
export async function recalc(cart: Cart): Promise<Cart> {
  const row = await findCart(cart.id);
  return row ? hydrate(row) : cart;
}

export async function createCart(userId: string | null = null): Promise<Cart> {
  return hydrate(await insertCart(userId));
}

export async function getCart(cartId: string | null | undefined): Promise<Cart | undefined> {
  if (!cartId) return undefined;
  const row = await findCart(cartId);
  return row ? hydrate(row) : undefined;
}

export async function getOrCreateCart(
  cartId: string | null | undefined,
  userId: string | null = null,
): Promise<Cart> {
  const row = cartId ? await findCart(cartId) : undefined;
  if (!row) return createCart(userId);
  if (userId && !row.userId) await claimCart(row.id, userId);
  return hydrate({ ...row, userId: row.userId ?? userId });
}

export async function addItem(
  cart: Cart,
  productId: string,
  quantity: number,
  color: string | null,
): Promise<{ ok: true; cart: Cart } | { ok: false; reason: 'not_found' | 'out_of_stock' | 'max_quantity' }> {
  const product = await findProductById(productId);
  if (!product) return { ok: false, reason: 'not_found' };
  if (product.stock <= 0) return { ok: false, reason: 'out_of_stock' };

  const existing = cart.items.find((item) => item.productId === productId && item.color === color);
  const targetQuantity = (existing?.quantity ?? 0) + quantity;

  if (targetQuantity > MAX_QUANTITY_PER_LINE) return { ok: false, reason: 'max_quantity' };
  if (targetQuantity > product.stock) return { ok: false, reason: 'out_of_stock' };

  // The unit price is frozen at the moment the line is created — a later price
  // revision must not rewrite a cart someone is looking at.
  await upsertCartItem(cart.id, {
    productId: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    color,
    unitPrice: existing?.unitPrice ?? product.price,
    quantity: targetQuantity,
  });

  return { ok: true, cart: await recalc(cart) };
}

export async function updateItemQuantity(
  cart: Cart,
  itemId: string,
  quantity: number,
): Promise<{ ok: true; cart: Cart } | { ok: false; reason: 'not_found' | 'out_of_stock' | 'max_quantity' }> {
  const item = cart.items.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: 'not_found' };

  if (quantity > MAX_QUANTITY_PER_LINE) return { ok: false, reason: 'max_quantity' };

  const product = await findProductById(item.productId);
  if (product && quantity > product.stock) return { ok: false, reason: 'out_of_stock' };

  if (quantity <= 0) await deleteCartItem(itemId);
  else await setCartItemQuantity(itemId, quantity);

  return { ok: true, cart: await recalc(cart) };
}

export async function removeItem(cart: Cart, itemId: string): Promise<{ ok: boolean; cart: Cart }> {
  const removed = await deleteCartItem(itemId);
  return { ok: removed, cart: await recalc(cart) };
}

export async function clearCart(cart: Cart): Promise<Cart> {
  await deleteCartItems(cart.id);
  await setCartCoupon(cart.id, null);
  return recalc(cart);
}
