import { created, enforceRateLimit, fail, ok, parseBody } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { clearCart } from '@/lib/cart';
import { resolveCart } from '@/lib/cart-session';
import { OutOfStockError, createOrder, ordersForUser } from '@/lib/repositories/orders';
import { createOrderSchema } from '@/lib/schemas';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Order history — always scoped to the authenticated caller. */
export async function GET(request: Request) {
  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Authentification requise.');

  const items = (await ordersForUser(user.id)).map(withoutAccessToken);

  return ok({ items, total: items.length });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit('order', request);
  if (limited) return limited;

  const parsed = await parseBody(request, createOrderSchema);
  if (!parsed.ok) return parsed.response;

  const user = await currentUserFromRequest(request);
  const email = user?.email ?? parsed.data.email;
  if (!email) {
    return fail('VALIDATION_ERROR', 'Les données envoyées sont invalides.', [
      { field: 'email', message: 'L’adresse e-mail est obligatoire pour une commande invité.' },
    ]);
  }

  const cart = await resolveCart(request);
  if (cart.items.length === 0) {
    return fail('EMPTY_CART', 'Votre panier est vide.');
  }

  // Stock is re-checked, decremented, and the order written in one transaction:
  // the cart may have been sitting there while another order emptied the shelf,
  // and a checkout that fails halfway must leave neither a partial order nor a
  // stock movement behind. See createOrder() for the locking.
  let order: Order;
  try {
    order = await createOrder({
      userId: user?.id ?? null,
      email,
      items: cart.items,
      totals: cart.totals,
      couponCode: cart.couponCode,
      shippingAddress: parsed.data.shippingAddress,
      billingAddress: parsed.data.billingAddress ?? parsed.data.shippingAddress,
      paymentMethod: parsed.data.paymentMethod,
    });
  } catch (error) {
    if (error instanceof OutOfStockError) return fail('OUT_OF_STOCK', error.message);
    throw error;
  }

  await clearCart(cart);

  // The access token is returned exactly once, at creation, so a guest can open
  // their confirmation page without an account.
  return created(order);
}

function withoutAccessToken(order: Order): Omit<Order, 'accessToken'> {
  const { accessToken: _accessToken, ...rest } = order;
  void _accessToken;
  return rest;
}
