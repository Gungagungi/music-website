import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { authSecret } from '@/lib/deployment';
import { findUserById } from '@/lib/repositories/users';
import type { PublicUser, User } from '@/lib/types';

export const AUTH_COOKIE = 'fretline_token';
export const CART_COOKIE = 'fretline_cart';
export const TOKEN_TTL_SECONDS = 60 * 60 * 8;

/**
 * The JWT signing key.
 *
 * A checked-in demo value in development and in the suite — the store holds no
 * real data, and a hard-coded key keeps `npm test` working without a .env file.
 * A production deployment must supply its own, or refuse to start; see
 * lib/deployment.ts.
 *
 * Memoised on first signature rather than at import: the check belongs to
 * startup, not to whichever request loaded this module first.
 */
let secretKey: Uint8Array | undefined;

function secret(): Uint8Array {
  secretKey ??= new TextEncoder().encode(authSecret());
  return secretKey;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  void _passwordHash;
  return rest;
}

export async function signToken(user: User): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('fretline')
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'fretline' });
    return payload.sub ? { sub: payload.sub } : null;
  } catch {
    return null;
  }
}

function bearerFrom(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Resolves the caller from either the session cookie (browser flows) or an
 * `Authorization: Bearer` header (API tests). Supporting both means the API
 * suite never has to simulate a cookie jar.
 */
export async function currentUserFromRequest(request: Request): Promise<User | null> {
  const token = bearerFrom(request) ?? (await cookies()).get(AUTH_COOKIE)?.value ?? null;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return (await findUserById(payload.sub)) ?? null;
}

/** Server-component variant: cookie only, no request object available. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return (await findUserById(payload.sub)) ?? null;
}

export async function currentCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

/** Cart id from the `x-cart-id` header (API tests) or the cookie (browser). */
export async function cartIdFromRequest(request: Request): Promise<string | null> {
  return request.headers.get('x-cart-id') ?? (await currentCartId());
}
