import { z } from 'zod';

import { created, fail, parseBody, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { toPublicUser } from '@/lib/auth';
import { getDb, hashPassword, nextUserId } from '@/lib/db';
import { getProductBySlug } from '@/lib/catalog';

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

  const db = getDb();
  const createdUsers = [];

  for (const seed of parsed.data.users ?? []) {
    const email = seed.email.toLowerCase();
    if (db.users.some((user) => user.email === email)) continue;
    const user = {
      id: nextUserId(),
      email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      passwordHash: hashPassword(seed.password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    createdUsers.push(toPublicUser(user));
  }

  const updatedStock = [];
  for (const entry of parsed.data.stock ?? []) {
    const product = getProductBySlug(entry.slug);
    if (!product) return fail('NOT_FOUND', `Produit « ${entry.slug} » introuvable.`);
    product.stock = entry.quantity;
    updatedStock.push({ slug: product.slug, stock: product.stock });
  }

  return created({ users: createdUsers, stock: updatedStock });
}
