import { cookies } from 'next/headers';

import { enforceRateLimit, fail, ok, parseBody } from '@/lib/api';
import {
  AUTH_COOKIE,
  TOKEN_TTL_SECONDS,
  sessionCookieOptions,
  signToken,
  toPublicUser,
} from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { findUserByEmail } from '@/lib/repositories/users';
import { loginSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Avant tout le reste : refuser coûte alors une comparaison de compteur, là
  // où laisser passer engage un scrypt de 50 à 100 ms. Placer la limite après
  // la validation du corps rendrait le refus aussi cher que l'acceptation.
  const limited = enforceRateLimit('login', request);
  if (limited) return limited;

  const parsed = await parseBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  // Same response whether the account is unknown or the password is wrong: the
  // API must not reveal which e-mail addresses are registered.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail('UNAUTHORIZED', 'Adresse e-mail ou mot de passe incorrect.');
  }

  const token = await signToken(user);
  (await cookies()).set(AUTH_COOKIE, token, sessionCookieOptions(TOKEN_TTL_SECONDS));

  return ok({ user: toPublicUser(user), token });
}
