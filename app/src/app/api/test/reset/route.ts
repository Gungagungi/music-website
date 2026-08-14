import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { resetDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Restores the seeded state. This is the single most important endpoint for the
 * test suite: it turns "did a previous spec leave data behind?" from a debugging
 * session into a non-question.
 *
 * It only exists when the app runs with E2E_TEST_MODE=1, and it still requires a
 * shared token — a test hook that ships enabled to production is a vulnerability,
 * not a convenience.
 */
export async function POST(request: Request) {
  if (!testEndpointsEnabled()) {
    return fail('NOT_FOUND', 'Endpoint inconnu.');
  }
  if (!testTokenValid(request)) {
    return fail('FORBIDDEN', 'Jeton de test invalide.');
  }

  const db = resetDb();
  return ok({
    reset: true,
    products: db.products.length,
    users: db.users.length,
    orders: db.orders.length,
    carts: db.carts.size,
  });
}
