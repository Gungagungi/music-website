import { resetDatabase } from '@/db/seed';
import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';

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

  // TRUNCATE plus a replay of the seeds, in a single transaction: a reset that
  // failed halfway would leave an empty catalogue behind, and the suite would
  // report dozens of unrelated failures instead of one clear error.
  const summary = await resetDatabase();
  return ok({ reset: true, ...summary });
}
