import { cookies } from 'next/headers';

import {
  CART_COOKIE,
  cartIdFromRequest,
  currentUserFromRequest,
  sessionCookieOptions,
} from '@/lib/auth';
import { emptyCart, getCart, getOrCreateCart } from '@/lib/cart';
import type { Cart } from '@/lib/types';

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Resolves the caller's cart from the `x-cart-id` header (API clients) or the
 * cookie (browser), **without creating one**.
 *
 * A visitor with no cart gets an ephemeral empty one that is never stored. This
 * is what keeps the table from filling with rows nobody asked for: every request
 * that so much as reads the cart used to insert one, so a crawler — which never
 * returns a cookie — minted a row per request. Those empty carts would have been
 * the overwhelming majority of the table, and purging them afterwards is
 * mopping around an open tap.
 */
export async function resolveCart(request: Request): Promise<Cart> {
  const requestedId = await cartIdFromRequest(request);
  const cart = await getCart(requestedId);
  if (!cart) return emptyCart();

  const user = await currentUserFromRequest(request);
  return isReachableBy(cart, user?.id ?? null) ? cart : emptyCart();
}

/**
 * A cart attached to an account is only reachable by that account.
 *
 * `getCart()` returns any cart whose identifier is presented, and `x-cart-id`
 * lets it be presented without a cookie — an audit found that any caller could
 * therefore read, fill and above all *order* someone else's cart, since
 * `POST /api/orders` starts from that cart.
 *
 * Identifiers are UUID v4, hence not guessable: this is defence in depth, not
 * closing an open door. It is still worth having, because a cart identifier
 * travels to places where a secret has no business — proxy logs, browsing
 * history, a screenshot from a support session.
 *
 * A guest cart (`userId === null`) stays reachable by anyone presenting its
 * identifier: that is exactly the cookie's rule, and retention is already
 * aligned with it (lib/retention.ts).
 */
function isReachableBy(cart: Cart, userId: string | null): boolean {
  return cart.userId === null || cart.userId === userId;
}

/**
 * Same, but for the one operation that genuinely needs somewhere to put a line:
 * adding to the cart. This is the only path allowed to insert a row, and the
 * only one that sets the cookie.
 */
export async function resolveCartForWrite(request: Request): Promise<Cart> {
  const user = await currentUserFromRequest(request);
  const userId = user?.id ?? null;
  const requestedId = await cartIdFromRequest(request);

  // Same rule as for reads: an identifier pointing at someone else's cart is
  // treated as if it had not been supplied, so a new cart is created. Refusing
  // with an error would tell the caller they had hit the mark.
  const existing = requestedId ? await getCart(requestedId) : undefined;
  const usableId = existing && !isReachableBy(existing, userId) ? null : requestedId;

  const cart = await getOrCreateCart(usableId, userId);

  if (cart.id !== requestedId) {
    (await cookies()).set(CART_COOKIE, cart.id, sessionCookieOptions(CART_COOKIE_MAX_AGE));
  }

  return cart;
}
