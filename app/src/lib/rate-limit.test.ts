import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RATE_LIMITS, callerKey, consume, resetRateLimits } from './rate-limit';

/**
 * L'algorithme du limiteur est éprouvé ici plutôt que par la suite d'API, et
 * c'est délibéré : `consume()` reçoit son horloge en paramètre, donc la fenêtre
 * qui se rouvre se vérifie en avançant un entier au lieu d'attendre soixante
 * secondes. Voir le commentaire de FACTEUR_MODE_TEST — la suite d'API, qui
 * tourne sous E2E_TEST_MODE, ne verrait de toute façon jamais le refus.
 */

/** Une requête nue, éventuellement porteuse d'un `x-forwarded-for`. */
function requete(ip?: string): Request {
  return new Request('https://exemple.fr/api/auth/login', {
    headers: ip ? { 'x-forwarded-for': ip } : {},
  });
}

describe('callerKey', () => {
  it('retient la première adresse de x-forwarded-for', () => {
    // La première est le client ; les suivantes sont les proxys traversés.
    expect(callerKey(requete('203.0.113.7, 172.25.0.5'))).toBe('203.0.113.7');
  });

  it('tombe sur une clé partagée quand aucune adresse n’est transmise', () => {
    expect(callerKey(requete())).toBe('inconnu');
  });
});

describe('consume', () => {
  beforeEach(() => {
    resetRateLimits();
    // Le facteur du mode test multiplierait chaque plafond par 250 et rendrait
    // ces assertions muettes.
    delete process.env.E2E_TEST_MODE;
  });

  afterEach(() => resetRateLimits());

  it('laisse passer jusqu’au plafond puis refuse', () => {
    const { limit } = RATE_LIMITS.login;

    for (let i = 1; i <= limit; i += 1) {
      const resultat = consume('login', requete('198.51.100.1'), 1_000);
      expect(resultat.allowed).toBe(true);
      expect(resultat.remaining).toBe(limit - i);
    }

    const refus = consume('login', requete('198.51.100.1'), 1_000);
    expect(refus.allowed).toBe(false);
    expect(refus.remaining).toBe(0);
  });

  it('compte séparément deux adresses', () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i += 1) {
      consume('login', requete('198.51.100.1'), 1_000);
    }

    // Saturer un appelant ne doit pas fermer la porte aux autres, sinon la
    // limite devient elle-même l'outil de déni de service.
    expect(consume('login', requete('198.51.100.2'), 1_000).allowed).toBe(true);
  });

  it('compte séparément deux routes', () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i += 1) {
      consume('login', requete('198.51.100.3'), 1_000);
    }

    expect(consume('coupon', requete('198.51.100.3'), 1_000).allowed).toBe(true);
  });

  it('rouvre la fenêtre une fois le délai écoulé', () => {
    const { limit, windowSeconds } = RATE_LIMITS.login;
    for (let i = 0; i < limit; i += 1) consume('login', requete('198.51.100.4'), 1_000);
    expect(consume('login', requete('198.51.100.4'), 1_000).allowed).toBe(false);

    const apres = 1_000 + windowSeconds * 1_000;
    expect(consume('login', requete('198.51.100.4'), apres).allowed).toBe(true);
  });

  it('continue de compter les requêtes déjà refusées', () => {
    const { limit, windowSeconds } = RATE_LIMITS.login;
    for (let i = 0; i < limit + 3; i += 1) consume('login', requete('198.51.100.5'), 1_000);

    // Un client qui ignore les 429 ne doit pas pouvoir tenir un débit constant
    // juste sous le plafond : la fenêtre ne se rouvre qu'à l'heure dite, pas
    // après un nombre d'acceptations.
    const justeAvant = 1_000 + windowSeconds * 1_000 - 1;
    expect(consume('login', requete('198.51.100.5'), justeAvant).allowed).toBe(false);
  });

  it('annonce un délai de réessai qui décroît avec le temps', () => {
    const { limit, windowSeconds } = RATE_LIMITS.login;
    for (let i = 0; i < limit; i += 1) consume('login', requete('198.51.100.6'), 1_000);

    const immediat = consume('login', requete('198.51.100.6'), 1_000);
    const plusTard = consume('login', requete('198.51.100.6'), 1_000 + 30_000);

    expect(immediat.retryAfterSeconds).toBe(windowSeconds);
    expect(plusTard.retryAfterSeconds).toBeLessThan(immediat.retryAfterSeconds);
    // Jamais zéro : un `Retry-After: 0` invite à réessayer sur-le-champ.
    expect(plusTard.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('desserre les plafonds sous E2E_TEST_MODE', () => {
    process.env.E2E_TEST_MODE = '1';
    const resultat = consume('register', requete('198.51.100.7'), 1_000);

    expect(resultat.limit).toBeGreaterThan(RATE_LIMITS.register.limit);
    expect(resultat.allowed).toBe(true);
  });
});
