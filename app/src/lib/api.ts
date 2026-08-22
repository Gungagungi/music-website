import { NextResponse } from 'next/server';
import type { ZodError, ZodType } from 'zod';

import { consume, type RateLimitName } from '@/lib/rate-limit';

/**
 * Every error the API can return uses this envelope. A single, predictable
 * shape is what lets the test suite assert on failures as precisely as on
 * successes — `expect(body.error.code).toBe('OUT_OF_STOCK')` beats string
 * matching on a free-form message.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'MAX_QUANTITY'
  | 'EMPTY_CART'
  | 'COUPON_UNKNOWN'
  | 'COUPON_EXPIRED'
  | 'COUPON_MIN_SUBTOTAL'
  | 'COUPON_CATEGORY'
  | 'RATE_LIMITED';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: { field: string; message: string }[];
  };
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  INVALID_JSON: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  MAX_QUANTITY: 422,
  EMPTY_CART: 422,
  COUPON_UNKNOWN: 404,
  COUPON_EXPIRED: 422,
  COUPON_MIN_SUBTOTAL: 422,
  COUPON_CATEGORY: 422,
  RATE_LIMITED: 429,
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function created<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { ...init, status: 201 });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: { field: string; message: string }[],
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

function flatten(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Parses and validates a JSON body, returning either the typed value or a ready
 * made 400/422 response. Malformed JSON and schema violations are deliberately
 * distinguished — they are different bugs on the client side.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ApiErrorBody> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail('INVALID_JSON', 'Le corps de la requête n’est pas un JSON valide.') };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: fail('VALIDATION_ERROR', 'Les données envoyées sont invalides.', flatten(result.error)),
    };
  }

  return { ok: true, data: result.data };
}

export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false; response: NextResponse<ApiErrorBody> } {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: fail('VALIDATION_ERROR', 'Paramètres de requête invalides.', flatten(result.error)),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Applies the rate limit for `name` and returns a ready-made 429 when the
 * caller is over quota, or `null` when the request may proceed.
 *
 * `Retry-After` is set because the envelope alone tells a client it was
 * throttled but not for how long, and a client left guessing retries
 * immediately — which is exactly the traffic the limit exists to shed.
 */
export function enforceRateLimit(
  name: RateLimitName,
  request: Request,
): NextResponse<ApiErrorBody> | null {
  const result = consume(name, request);
  if (result.allowed) return null;

  const response = fail(
    'RATE_LIMITED',
    'Trop de requêtes. Merci de réessayer dans un instant.',
  );
  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', '0');
  return response;
}

/** Test-only endpoints are invisible unless the app runs in E2E mode. */
export function testEndpointsEnabled(): boolean {
  return process.env.E2E_TEST_MODE === '1';
}

export function testTokenValid(request: Request): boolean {
  const expected = process.env.TEST_API_TOKEN ?? 'fretline-e2e-token';
  return request.headers.get('x-test-token') === expected;
}
