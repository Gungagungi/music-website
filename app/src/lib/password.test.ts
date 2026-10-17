import { describe, expect, it } from 'vitest';

import { hashPassword, seedPasswordHash, verifyPassword } from '@/lib/password';

/**
 * scrypt costs 50 to 100 ms per call: these tests make as few calls as
 * possible, and reuse one hash wherever the salt value does not matter.
 */

const HASH = hashPassword('motdepasse');

describe('hashPassword', () => {
  it('produit « sel:dérivé » en hexadécimal', () => {
    const [sel, derive] = HASH.split(':');
    expect(sel).toMatch(/^[0-9a-f]{32}$/);
    expect(derive).toMatch(/^[0-9a-f]{128}$/);
  });

  it('sale chaque hash séparément', () => {
    // Two accounts with the same password must not be recognisable as such in
    // the table.
    expect(hashPassword('motdepasse')).not.toBe(HASH);
  });
});

describe('verifyPassword', () => {
  it('accepte le mot de passe d’origine', () => {
    expect(verifyPassword('motdepasse', HASH)).toBe(true);
  });

  it('refuse un mot de passe voisin', () => {
    expect(verifyPassword('motdepassE', HASH)).toBe(false);
    expect(verifyPassword('motdepass', HASH)).toBe(false);
    expect(verifyPassword('', HASH)).toBe(false);
  });

  it('refuse une valeur stockée malformée sans lever', () => {
    // `timingSafeEqual` throws on buffers of different lengths: a corrupted row
    // must produce a refusal, not a 500 on sign-in.
    for (const stocke of ['', ':', 'sansdeuxpoints', 'sel:', ':derive', 'sel:trop-court']) {
      expect(verifyPassword('motdepasse', stocke)).toBe(false);
    }
  });

  it('refuse un dérivé de bonne longueur mais faux', () => {
    const [sel] = HASH.split(':');
    expect(verifyPassword('motdepasse', `${sel}:${'0'.repeat(128)}`)).toBe(false);
  });
});

describe('seedPasswordHash', () => {
  it('mémoïse par mot de passe en clair', () => {
    // This is what keeps `POST /api/test/reset` under a second: three scrypt
    // hashes cost more than every INSERT of the reset combined.
    expect(seedPasswordHash('graine')).toBe(seedPasswordHash('graine'));
    expect(seedPasswordHash('autre')).not.toBe(seedPasswordHash('graine'));
  });

  it('reste vérifiable comme un hash ordinaire', () => {
    expect(verifyPassword('graine', seedPasswordHash('graine'))).toBe(true);
  });
});
