import { fail, ok } from '@/lib/api';
import { currentUserFromRequest, toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Authentification requise.');
  return ok(toPublicUser(user));
}
