import { cookies } from 'next/headers';

import { created, enforceRateLimit, fail, parseBody } from '@/lib/api';
import {
  AUTH_COOKIE,
  TOKEN_TTL_SECONDS,
  sessionCookieOptions,
  signToken,
  toPublicUser,
} from '@/lib/auth';
import { createUser } from '@/lib/repositories/users';
import { registerSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = enforceRateLimit('register', request);
  if (limited) return limited;

  const parsed = await parseBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;

  // `undefined` covers both the plain "address already taken" case and the race
  // where two registrations arrive together — the unique index settles it, and
  // the loser gets this same answer rather than a 500.
  const user = await createUser(parsed.data);
  if (!user) {
    return fail('CONFLICT', 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const token = await signToken(user);
  (await cookies()).set(AUTH_COOKIE, token, sessionCookieOptions(TOKEN_TTL_SECONDS));

  return created({ user: toPublicUser(user), token });
}
