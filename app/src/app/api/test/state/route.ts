import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { readServerState } from '@/lib/repositories/introspection';

export const dynamic = 'force-dynamic';

/** Introspection helper: lets a spec assert on server state it cannot see via the UI. */
export async function GET(request: Request) {
  if (!testEndpointsEnabled()) return fail('NOT_FOUND', 'Endpoint inconnu.');
  if (!testTokenValid(request)) return fail('FORBIDDEN', 'Jeton de test invalide.');

  return ok(await readServerState());
}
