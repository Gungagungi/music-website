import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { purgeStaleCarts } from '@/lib/repositories/carts';

export const dynamic = 'force-dynamic';

/**
 * Runs the cart retention policy on demand.
 *
 * In production the same function runs on a schedule, from the `purge` service.
 * Exposing it here lets the suite exercise the actual rule — the one that
 * deletes rows — rather than a reimplementation of it that would agree with a
 * broken policy as readily as with a correct one.
 *
 * Same two guards as the rest of `/api/test/*`: invisible without
 * `E2E_TEST_MODE=1`, then refused without a valid token.
 */
export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return fail('NOT_FOUND', 'Endpoint inconnu.');
  if (!testTokenValid(request)) return fail('FORBIDDEN', 'Jeton de test invalide.');

  return ok(await purgeStaleCarts());
}
