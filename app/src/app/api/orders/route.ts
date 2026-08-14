import { randomUUID } from 'node:crypto';

import { created, fail, ok, parseBody } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { clearCart } from '@/lib/cart';
import { resolveCart } from '@/lib/cart-session';
import { getProductById } from '@/lib/catalog';
import { getDb, newId, nextOrderReference } from '@/lib/db';
import { createOrderSchema } from '@/lib/schemas';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Order history — always scoped to the authenticated caller. */
export async function GET(request: Request) {
  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Authentification requise.');

  const items = getDb()
    .orders.filter((order) => order.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withoutAccessToken);

  return ok({ items, total: items.length });
}

export async function POST(request: Request) {
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

  // Stock is re-checked at checkout: the cart may have been sitting there while
  // another order emptied the shelf.
  for (const item of cart.items) {
    const product = getProductById(item.productId);
    if (!product || product.stock < item.quantity) {
      return fail('OUT_OF_STOCK', `Stock insuffisant pour « ${item.name} ».`);
    }
  }

  for (const item of cart.items) {
    const product = getProductById(item.productId)!;
    product.stock -= item.quantity;
  }

  const order: Order = {
    id: newId(),
    reference: nextOrderReference(),
    userId: user?.id ?? null,
    email,
    items: structuredClone(cart.items),
    totals: { ...cart.totals },
    couponCode: cart.couponCode,
    shippingAddress: parsed.data.shippingAddress,
    billingAddress: parsed.data.billingAddress ?? parsed.data.shippingAddress,
    paymentMethod: parsed.data.paymentMethod,
    status: 'confirmee',
    createdAt: new Date().toISOString(),
    accessToken: randomUUID(),
  };

  getDb().orders.push(order);
  clearCart(cart);

  // The access token is returned exactly once, at creation, so a guest can open
  // their confirmation page without an account.
  return created(order);
}

function withoutAccessToken(order: Order): Omit<Order, 'accessToken'> {
  const { accessToken: _accessToken, ...rest } = order;
  void _accessToken;
  return rest;
}
