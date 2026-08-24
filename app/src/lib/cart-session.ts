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
 * Un panier rattaché à un compte n'est atteignable que par ce compte.
 *
 * `getCart()` rend n'importe quel panier dont on présente l'identifiant, et
 * `x-cart-id` permet de le présenter sans cookie — un audit a relevé qu'un
 * appelant quelconque pouvait donc lire, garnir et surtout *commander* le
 * panier d'un autre, `POST /api/orders` partant de ce panier-là.
 *
 * Les identifiants sont des UUID v4, donc non devinables : c'est de la défense
 * en profondeur, pas la fermeture d'une porte ouverte. Elle vaut quand même,
 * parce qu'un identifiant de panier voyage dans des endroits où un secret n'a
 * rien à faire — journaux du proxy, historique de navigation, capture d'écran
 * d'une session de support.
 *
 * Un panier invité (`userId === null`) reste atteignable par quiconque présente
 * son identifiant : c'est exactement la règle du cookie, et la rétention est
 * déjà alignée dessus (lib/retention.ts).
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

  // Même règle qu'en lecture : un identifiant désignant le panier de quelqu'un
  // d'autre est traité comme s'il n'avait pas été fourni, donc un panier neuf
  // est créé. Refuser par une erreur dirait à l'appelant qu'il a visé juste.
  const existing = requestedId ? await getCart(requestedId) : undefined;
  const usableId = existing && !isReachableBy(existing, userId) ? null : requestedId;

  const cart = await getOrCreateCart(usableId, userId);

  if (cart.id !== requestedId) {
    (await cookies()).set(CART_COOKIE, cart.id, sessionCookieOptions(CART_COOKIE_MAX_AGE));
  }

  return cart;
}
