import { cookies } from 'next/headers';

import { created, fail, parseBody } from '@/lib/api';
import { AUTH_COOKIE, TOKEN_TTL_SECONDS, signToken, toPublicUser } from '@/lib/auth';
import { getDb, hashPassword, nextUserId } from '@/lib/db';
import { registerSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const { email, password, firstName, lastName } = parsed.data;

  if (db.users.some((user) => user.email === email)) {
    return fail('CONFLICT', 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const user = {
    id: nextUserId(),
    email,
    firstName,
    lastName,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);

  const token = await signToken(user);
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  });

  return created({ user: toPublicUser(user), token });
}
