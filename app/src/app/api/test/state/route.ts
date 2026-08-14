import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Introspection helper: lets a spec assert on server state it cannot see via the UI. */
export async function GET(request: Request) {
  if (!testEndpointsEnabled()) return fail('NOT_FOUND', 'Endpoint inconnu.');
  if (!testTokenValid(request)) return fail('FORBIDDEN', 'Jeton de test invalide.');

  const db = getDb();
  return ok({
    products: db.products.length,
    users: db.users.length,
    carts: db.carts.size,
    orders: db.orders.length,
    reviews: db.reviews.length,
    counters: db.counters,
  });
}
