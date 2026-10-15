import { fail, ok, testEndpointsEnabled, testTokenValid } from '@/lib/api';
import { notifyRestocked } from '@/lib/repositories/stock-alerts';

export const dynamic = 'force-dynamic';

/**
 * Runs the restock sweep on demand.
 *
 * Same reasoning as `/api/test/purge`: in production this runs on a schedule,
 * beside the cart purge, and exposing the real function is what lets the suite
 * assert the rule that matters — an alert fires once and only once — instead of
 * a reimplementation that would agree with a broken sweep just as readily.
 *
 * Sending the mail itself is out of scope: a fictional shop with a real SMTP
 * dependency would make the suite need a mail server. What is modelled is the
 * part that carries rules.
 */
export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return fail('NOT_FOUND', 'Endpoint inconnu.');
  if (!testTokenValid(request)) return fail('FORBIDDEN', 'Jeton de test invalide.');

  return ok({ notified: await notifyRestocked() });
}
