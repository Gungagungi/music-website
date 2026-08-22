import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

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
  const derived = scryptSync(password, salt, 64);

  // Comparaison à temps constant. La version précédente utilisait `===` en
  // assumant qu'une démo n'en avait pas besoin ; un audit l'a relevé, et
  // l'argument ne tient pas : `timingSafeEqual` coûte trois lignes, tandis que
  // `===` sort au premier octet différent et rend la durée de la comparaison
  // fonction du préfixe deviné.
  //
  // `timingSafeEqual` exige deux tampons de même longueur — il lève sinon, au
  // lieu de renvoyer false. La longueur est donc vérifiée d'abord, et elle ne
  // révèle rien : elle est constante pour tout hash que cette fonction a
  // produit, et n'est différente que pour une valeur stockée corrompue.
  let expectedBytes: Buffer;
  try {
    expectedBytes = Buffer.from(expected, 'hex');
  } catch {
    return false;
  }
  if (expectedBytes.length !== derived.length) return false;

  return timingSafeEqual(derived, expectedBytes);
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
