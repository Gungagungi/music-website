import { z } from 'zod';

import { created, fail, parseBody, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { toPublicUser } from '@/lib/auth';
import { backdateCart } from '@/lib/repositories/carts';
import { setProductStock } from '@/lib/repositories/products';
import { createUser } from '@/lib/repositories/users';

export const dynamic = 'force-dynamic';

const seedSchema = z.object({
  users: z
    .array(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      }),
    )
    .optional(),
  stock: z
    .array(z.object({ slug: z.string().min(1), quantity: z.number().int().min(0) }))
    .optional(),
  // Ages a cart so the retention policy can be exercised without waiting a
  // month. See backdateCart() for why the clock is moved rather than the rule.
  carts: z
    .array(z.object({ id: z.string().min(1), ageHours: z.number().int().min(0) }))
    .optional(),
});

/**
 * Arranges preconditions a spec needs but should not have to click through:
 * pre-existing accounts, or a product forced into a specific stock level so the
 * "last item in stock" path can be exercised deterministically.
 */
export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return fail('NOT_FOUND', 'Endpoint inconnu.');
  if (!testTokenValid(request)) return fail('FORBIDDEN', 'Jeton de test invalide.');

  const parsed = await parseBody(request, seedSchema);
  if (!parsed.ok) return parsed.response;

  const createdUsers = [];

  // An address that already exists is skipped, not an error: the endpoint states
  // a precondition ("this account exists"), and re-running a spec must not start
  // failing just because the arrangement already holds.
  for (const seed of parsed.data.users ?? []) {
    const user = await createUser(seed);
    if (user) createdUsers.push(toPublicUser(user));
  }

  const updatedStock = [];
  for (const entry of parsed.data.stock ?? []) {
    const product = await setProductStock(entry.slug, entry.quantity);
    if (!product) return fail('NOT_FOUND', `Produit « ${entry.slug} » introuvable.`);
    updatedStock.push({ slug: product.slug, stock: product.stock });
  }

  const agedCarts = [];
  for (const entry of parsed.data.carts ?? []) {
    await backdateCart(entry.id, entry.ageHours);
    agedCarts.push({ id: entry.id, ageHours: entry.ageHours });
  }

  return created({ users: createdUsers, stock: updatedStock, carts: agedCarts });
}
