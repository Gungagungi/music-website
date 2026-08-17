import { randomBytes, scryptSync } from 'node:crypto';

/**
 * Password hashing, extracted from lib/db.ts so it survives the move to
 * PostgreSQL — it never had anything to do with where rows are stored.
 */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  // Length-safe comparison; the demo does not need constant-time semantics but
  // the equality shape should still not leak on differing lengths.
  return derived.length === expected.length && derived === expected;
}

/**
 * Hashes memoised per process, keyed by the clear-text seed password.
 *
 * scrypt is deliberately slow — around 50-100 ms per call — so hashing the three
 * seeded accounts costs more than every INSERT in the reset put together. The
 * suite resets once per run, but a developer hits it many times an hour, and
 * `POST /api/test/reset` has to stay comfortably sub-second to keep the workflow
 * the in-memory store used to give for free.
 */
const seedHashes = new Map<string, string>();

export function seedPasswordHash(password: string): string {
  let hash = seedHashes.get(password);
  if (!hash) {
    hash = hashPassword(password);
    seedHashes.set(password, hash);
  }
  return hash;
}
