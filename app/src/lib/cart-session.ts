import { cookies } from 'next/headers';

import { CART_COOKIE, cartIdFromRequest, currentUserFromRequest } from '@/lib/auth';
import { getOrCreateCart } from '@/lib/cart';
import type { Cart } from '@/lib/types';

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Resolves the caller's cart from the `x-cart-id` header (API clients) or the
 * cookie (browser), creating one on the fly and persisting the id when needed.
 */
export async function resolveCart(request: Request): Promise<Cart> {
  const user = await currentUserFromRequest(request);
  const requestedId = await cartIdFromRequest(request);
  const cart = getOrCreateCart(requestedId, user?.id ?? null);

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
