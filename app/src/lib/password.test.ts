import { describe, expect, it } from 'vitest';

import { hashPassword, seedPasswordHash, verifyPassword } from '@/lib/password';

/**
 * scrypt coûte 50 à 100 ms par appel : ces tests en font le moins possible, et
 * réutilisent un même hash partout où la valeur du sel est indifférente.
 */

const HASH = hashPassword('motdepasse');

describe('hashPassword', () => {
  it('produit « sel:dérivé » en hexadécimal', () => {
    const [sel, derive] = HASH.split(':');
    expect(sel).toMatch(/^[0-9a-f]{32}$/);
    expect(derive).toMatch(/^[0-9a-f]{128}$/);
  });

  it('sale chaque hash séparément', () => {
    // Deux comptes ayant le même mot de passe ne doivent pas se reconnaître
    // dans la table.
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
    // `timingSafeEqual` lève sur deux tampons de longueurs différentes : une
    // ligne corrompue doit donner un refus, pas une 500 sur la connexion.
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
    // C'est ce qui tient `POST /api/test/reset` sous la seconde : trois hashs
    // scrypt coûtent plus que tous les INSERT du reset réunis.
    expect(seedPasswordHash('graine')).toBe(seedPasswordHash('graine'));
    expect(seedPasswordHash('autre')).not.toBe(seedPasswordHash('graine'));
  });

  it('reste vérifiable comme un hash ordinaire', () => {
    expect(verifyPassword('graine', seedPasswordHash('graine'))).toBe(true);
  });
});
