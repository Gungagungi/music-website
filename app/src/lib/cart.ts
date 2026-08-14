import { getDb, newId } from '@/lib/db';
import { getProductById } from '@/lib/catalog';
import { applyPercent, roundCents, shippingFor, vatIncludedIn } from '@/lib/money';
import { MAX_QUANTITY_PER_LINE } from '@/lib/cart-constants';
import type { Cart, CartItem, CartTotals, Coupon } from '@/lib/types';

export { MAX_QUANTITY_PER_LINE };

/**
 * One deliberately seeded defect, gated behind SEED_BUGS=1.
 * See docs/bug-reports/BUG-001-coupon-rounding.md — percentage discounts are
 * truncated to whole euros, so the amount deducted does not match the announced
 * percentage on any cart whose subtotal is not a round number of euros.
 */
const COUPON_ROUNDING_BUG_ENABLED = process.env.SEED_BUGS === '1';

export function emptyTotals(): CartTotals {
  return { subtotal: 0, discount: 0, shipping: 0, vat: 0, total: 0, itemCount: 0 };
}

export function findCoupon(code: string): Coupon | undefined {
  return getDb().coupons.find((coupon) => coupon.code.toUpperCase() === code.trim().toUpperCase());
}

export type CouponRejection =
  | { ok: true; coupon: Coupon }
  | { ok: false; reason: 'unknown' | 'expired' | 'min_subtotal' | 'category'; coupon?: Coupon };

export function evaluateCoupon(code: string, items: CartItem[]): CouponRejection {
  const coupon = findCoupon(code);
  if (!coupon) return { ok: false, reason: 'unknown' };

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { ok: false, reason: 'expired', coupon };
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, reason: 'min_subtotal', coupon };
  }

  if (coupon.category && eligibleSubtotal(items, coupon) === 0) {
    return { ok: false, reason: 'category', coupon };
  }

  return { ok: true, coupon };
}

/** Subtotal the coupon actually applies to — the whole cart, or one category. */
function eligibleSubtotal(items: CartItem[], coupon: Coupon): number {
  if (!coupon.category) {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }
  return items.reduce((sum, item) => {
    const product = getProductById(item.productId);
    return product?.category === coupon.category ? sum + item.lineTotal : sum;
  }, 0);
}

export function discountFor(items: CartItem[], coupon: Coupon | undefined): number {
  if (!coupon) return 0;
  const base = eligibleSubtotal(items, coupon);
  if (base === 0) return 0;

  if (coupon.type === 'percent') {
    if (COUPON_ROUNDING_BUG_ENABLED) {
      return Math.floor((base * coupon.value) / 100 / 100) * 100;
    }
    return applyPercent(base, coupon.value);
  }
  return Math.min(coupon.value, base);
}

export function computeTotals(items: CartItem[], couponCode: string | null): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const coupon = couponCode ? findCoupon(couponCode) : undefined;
  const evaluated = coupon && couponCode ? evaluateCoupon(couponCode, items) : undefined;
  const discount = evaluated?.ok ? discountFor(items, coupon) : 0;
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

export function recalc(cart: Cart): Cart {
  // A coupon can become invalid after the cart changes (quantity lowered below
  // the minimum), so it is re-evaluated on every mutation instead of at apply time.
  if (cart.couponCode) {
    const evaluated = evaluateCoupon(cart.couponCode, cart.items);
    if (!evaluated.ok) cart.couponCode = null;
  }
  cart.totals = computeTotals(cart.items, cart.couponCode);
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export function createCart(userId: string | null = null): Cart {
  const cart: Cart = {
    id: newId(),
    userId,
    items: [],
    couponCode: null,
    totals: emptyTotals(),
    updatedAt: new Date().toISOString(),
  };
  getDb().carts.set(cart.id, cart);
  return cart;
}

export function getCart(cartId: string | null | undefined): Cart | undefined {
  if (!cartId) return undefined;
  return getDb().carts.get(cartId);
}

export function getOrCreateCart(cartId: string | null | undefined, userId: string | null = null): Cart {
  const existing = getCart(cartId);
  if (existing) {
    if (userId && !existing.userId) existing.userId = userId;
    return existing;
  }
  return createCart(userId);
}

export function addItem(
  cart: Cart,
  productId: string,
  quantity: number,
  color: string | null,
): { ok: true; cart: Cart } | { ok: false; reason: 'not_found' | 'out_of_stock' | 'max_quantity' } {
  const product = getProductById(productId);
  if (!product) return { ok: false, reason: 'not_found' };
  if (product.stock <= 0) return { ok: false, reason: 'out_of_stock' };

  const existing = cart.items.find((item) => item.productId === productId && item.color === color);
  const targetQuantity = (existing?.quantity ?? 0) + quantity;

  if (targetQuantity > MAX_QUANTITY_PER_LINE) return { ok: false, reason: 'max_quantity' };
  if (targetQuantity > product.stock) return { ok: false, reason: 'out_of_stock' };

  if (existing) {
    existing.quantity = targetQuantity;
    existing.lineTotal = roundCents(existing.unitPrice * existing.quantity);
  } else {
    cart.items.push({
      id: newId(),
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      color,
      unitPrice: product.price,
      quantity,
      lineTotal: roundCents(product.price * quantity),
    });
  }

  return { ok: true, cart: recalc(cart) };
}

export function updateItemQuantity(
  cart: Cart,
  itemId: string,
  quantity: number,
): { ok: true; cart: Cart } | { ok: false; reason: 'not_found' | 'out_of_stock' | 'max_quantity' } {
  const item = cart.items.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: 'not_found' };

  if (quantity > MAX_QUANTITY_PER_LINE) return { ok: false, reason: 'max_quantity' };

  const product = getProductById(item.productId);
  if (product && quantity > product.stock) return { ok: false, reason: 'out_of_stock' };

  if (quantity <= 0) {
    cart.items = cart.items.filter((candidate) => candidate.id !== itemId);
  } else {
    item.quantity = quantity;
    item.lineTotal = roundCents(item.unitPrice * quantity);
  }

  return { ok: true, cart: recalc(cart) };
}

export function removeItem(cart: Cart, itemId: string): { ok: boolean; cart: Cart } {
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => item.id !== itemId);
  return { ok: cart.items.length !== before, cart: recalc(cart) };
}

export function clearCart(cart: Cart): Cart {
  cart.items = [];
  cart.couponCode = null;
  return recalc(cart);
}
