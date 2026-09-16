/**
 * Fixed-window rate limiting.
 *
 * The error envelope had declared `RATE_LIMITED` and its 429 since day one, but
 * nothing ever emitted it: the code existed, the mechanism did not. An audit
 * flagged it on `POST /api/auth/login`, which runs scrypt — deliberately slow,
 * 50 to 100 ms — before answering. Without a limit, the same route serves both
 * brute force and denial of service: the breaking-point test puts production's
 * wall between 80 and 90 journeys per second, CPU-bound, and a few dozen
 * requests per second on `login` are enough to reach it.
 *
 * In-memory counter, not Redis. The deployment is a single container
 * (docker-compose.yml): one more dependency would cost a service, a volume and
 * an extra failure mode for state this process already holds. The limit is
 * **per process** — the day the application moves to two replicas, the
 * effective ceiling doubles, and that is the moment to move this counter, not
 * before.
 *
 * Pinned on `globalThis` for the same reason as the PostgreSQL pool
 * (db/client.ts): Next reloads modules in development, and a fresh counter on
 * every reload would reset the limit on every save.
 */

import { isTestMode } from '@/lib/deployment';

export interface RateLimitRule {
  /** Number of requests allowed per window. */
  limit: number;
  /** Window length, in seconds. */
  windowSeconds: number;
}

/**
 * Rules are tight where a call is expensive for the server or leads to a
 * secret, and loose elsewhere. A legitimate visitor never reaches them: six
 * login attempts per minute comfortably covers a typo.
 */
export const RATE_LIMITS = {
  login: { limit: 6, windowSeconds: 60 },
  register: { limit: 4, windowSeconds: 600 },
  order: { limit: 10, windowSeconds: 600 },
  review: { limit: 5, windowSeconds: 600 },
  coupon: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Multiplier applied to the ceilings under `E2E_TEST_MODE=1`.
 *
 * The suite runs with no proxy in front of it, hence no `x-forwarded-for`: all
 * of its calls share one and the same bucket. Four sign-ups per ten minutes, a
 * sensible production ceiling, stops the suite at the fifteenth test — which
 * actually happened.
 *
 * A multiplier rather than a bypass: the code path is still taken on every
 * request, headers included, so a regression that broke the limiter would
 * still show. What changes is the bound, not the mechanism. The algorithm
 * itself is exercised by the unit tests — `consume()` takes its clock as a
 * parameter precisely for that — rather than by the API suite, where it would
 * take a thousand requests to see a 429.
 *
 * Never apply it outside test mode: the discriminator is the same as
 * everywhere else in this repository (lib/deployment.ts), and it fails closed.
 */
const FACTEUR_MODE_TEST = 250;

function effectiveLimit(rule: RateLimitRule): number {
  return isTestMode() ? rule.limit * FACTEUR_MODE_TEST : rule.limit;
}

interface Window {
  count: number;
  /** Window end timestamp, in milliseconds. */
  resetAt: number;
}

const STORE = Symbol.for('fretline.rateLimit');

interface GlobalWithStore {
  [STORE]?: Map<string, Window>;
}

function store(): Map<string, Window> {
  const holder = globalThis as GlobalWithStore;
  holder[STORE] ??= new Map();
  return holder[STORE];
}

/**
 * Evicts expired windows.
 *
 * Without it the Map grows by one entry per IP address seen and never gives
 * anything back: a long enough scan would end up holding the container's whole
 * memory. Eviction is amortised over writes rather than handed to a
 * `setInterval`, which would keep the process awake for nothing.
 */
function purgeExpired(now: number): void {
  for (const [key, window] of store()) {
    if (window.resetAt <= now) store().delete(key);
  }
}

let writesSincePurge = 0;
const PURGE_EVERY = 500;

/**
 * Identifies the caller.
 *
 * `x-forwarded-for` can only be trusted because Caddy is the sole entry point
 * (docker-compose.yml: the application publishes no port on the host) and it
 * rewrites the header. Exposing `app` directly would make this value forgeable,
 * and the limit bypassable with a single header.
 *
 * The first address in the list is the client; the following ones are the
 * proxies traversed.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'inconnu';
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Seconds to wait before the window reopens. */
  retryAfterSeconds: number;
  limit: number;
}

/**
 * Consumes one unit of quota and says whether the call may go through.
 *
 * The counter is incremented even when the answer will be a refusal: that is
 * what prevents holding a steady rate just under the ceiling by ignoring the
 * 429s.
 */
export function consume(
  name: RateLimitName,
  request: Request,
  now: number = Date.now(),
): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const limit = effectiveLimit(rule);
  const key = `${name}:${callerKey(request)}`;
  const windowMs = rule.windowSeconds * 1000;

  if (++writesSincePurge >= PURGE_EVERY) {
    writesSincePurge = 0;
    purgeExpired(now);
  }

  let window = store().get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + windowMs };
    store().set(key, window);
  }

  window.count += 1;

  const allowed = window.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - window.count),
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    limit,
  };
}

/** Clears the counter. Reserved for unit tests. */
export function resetRateLimits(): void {
  store().clear();
  writesSincePurge = 0;
}
