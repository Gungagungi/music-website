import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RATE_LIMITS, callerKey, consume, resetRateLimits } from './rate-limit';

/**
 * The limiter's algorithm is exercised here rather than by the API suite, and
 * that is deliberate: `consume()` takes its clock as a parameter, so a window
 * reopening is checked by advancing an integer instead of waiting sixty
 * seconds. See the comment on FACTEUR_MODE_TEST — the API suite, which runs
 * under E2E_TEST_MODE, would never see the refusal anyway.
 */

/** A bare request, optionally carrying an `x-forwarded-for`. */
function requete(ip?: string): Request {
  return new Request('https://exemple.fr/api/auth/login', {
    headers: ip ? { 'x-forwarded-for': ip } : {},
  });
}

describe('callerKey', () => {
  it('retient la première adresse de x-forwarded-for', () => {
    // The first one is the client; the following ones are the proxies traversed.
    expect(callerKey(requete('203.0.113.7, 172.25.0.5'))).toBe('203.0.113.7');
  });

  it('tombe sur une clé partagée quand aucune adresse n’est transmise', () => {
    expect(callerKey(requete())).toBe('inconnu');
  });
});

describe('consume', () => {
  beforeEach(() => {
    resetRateLimits();
    // The test-mode multiplier would multiply every ceiling by 250 and silence
    // these assertions.
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

    // Saturating one caller must not shut the door on the others, otherwise the
    // limit itself becomes the denial-of-service tool.
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

    // A client that ignores 429s must not be able to hold a steady rate just
    // under the ceiling: the window only reopens at the set time, not after a
    // number of acceptances.
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
    // Never zero: a `Retry-After: 0` invites an immediate retry.
    expect(plusTard.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('desserre les plafonds sous E2E_TEST_MODE', () => {
    process.env.E2E_TEST_MODE = '1';
    const resultat = consume('register', requete('198.51.100.7'), 1_000);

    expect(resultat.limit).toBeGreaterThan(RATE_LIMITS.register.limit);
    expect(resultat.allowed).toBe(true);
  });
});
