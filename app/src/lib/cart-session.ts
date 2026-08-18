import { cookies } from 'next/headers';

import { CART_COOKIE, cartIdFromRequest, currentUserFromRequest } from '@/lib/auth';
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
  return (await getCart(requestedId)) ?? emptyCart();
}

/**
 * Same, but for the one operation that genuinely needs somewhere to put a line:
 * adding to the cart. This is the only path allowed to insert a row, and the
 * only one that sets the cookie.
 */
export async function resolveCartForWrite(request: Request): Promise<Cart> {
  const user = await currentUserFromRequest(request);
  const requestedId = await cartIdFromRequest(request);
  const cart = await getOrCreateCart(requestedId, user?.id ?? null);

  if (cart.id !== requestedId) {
    (await cookies()).set(CART_COOKIE, cart.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }

  return cart;
}
