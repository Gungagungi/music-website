import { fail, ok } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { alertsForUser } from '@/lib/repositories/stock-alerts';

export const dynamic = 'force-dynamic';

/** The signed-in customer's own alerts — never anybody else's. */
export async function GET(request: Request) {
  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour consulter vos alertes.');

  return ok({ items: await alertsForUser(user.id) });
}
