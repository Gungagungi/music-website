import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  type ApiErrorBody,
  created,
  enforceRateLimit,
  fail,
  ok,
  parseBody,
  parseQuery,
  testEndpointsEnabled,
  testTokenValid,
} from '@/lib/api';
import { RATE_LIMITS, resetRateLimits } from '@/lib/rate-limit';

/**
 * L'enveloppe d'erreur est ce qui permet aux specs d'asserter
 * `body.error.code === 'OUT_OF_STOCK'` plutôt que de matcher une chaîne : le
 * code HTTP en est *dérivé*, il n'est pas choisi à l'appel. Ces tests tiennent
 * cette dérivation, et la distinction délibérée entre JSON malformé et schéma
 * violé — deux bugs différents côté client.
 */

async function corps<T>(reponse: { json(): Promise<T> }): Promise<T> {
  return reponse.json();
}

function requete(body: string, url = 'https://exemple.fr/api/cart/items'): Request {
  return new Request(url, { method: 'POST', body });
}

describe('ok / created', () => {
  it('répond 200 et sérialise la donnée', async () => {
    const reponse = ok({ total: 12_345 });
    expect(reponse.status).toBe(200);
    expect(await corps(reponse)).toEqual({ total: 12_345 });
  });

  it('force 201 sur created, même si init en propose un autre', () => {
    expect(created({ id: 'x' }, { status: 200 }).status).toBe(201);
  });
});

describe('fail', () => {
  it('dérive le statut du code', () => {
    expect(fail('VALIDATION_ERROR', 'x').status).toBe(422);
    expect(fail('INVALID_JSON', 'x').status).toBe(400);
    expect(fail('UNAUTHORIZED', 'x').status).toBe(401);
    expect(fail('FORBIDDEN', 'x').status).toBe(403);
    expect(fail('NOT_FOUND', 'x').status).toBe(404);
    expect(fail('CONFLICT', 'x').status).toBe(409);
    expect(fail('OUT_OF_STOCK', 'x').status).toBe(409);
    expect(fail('MAX_QUANTITY', 'x').status).toBe(422);
    expect(fail('EMPTY_CART', 'x').status).toBe(422);
    expect(fail('COUPON_UNKNOWN', 'x').status).toBe(404);
    expect(fail('COUPON_EXPIRED', 'x').status).toBe(422);
    expect(fail('COUPON_MIN_SUBTOTAL', 'x').status).toBe(422);
    expect(fail('COUPON_CATEGORY', 'x').status).toBe(422);
    expect(fail('RATE_LIMITED', 'x').status).toBe(429);
  });

  it('n’émet la clé details que lorsqu’elle existe', async () => {
    const sans = await corps<ApiErrorBody>(fail('NOT_FOUND', 'Introuvable.'));
    expect(sans).toEqual({ error: { code: 'NOT_FOUND', message: 'Introuvable.' } });
    expect('details' in sans.error).toBe(false);

    const avec = await corps<ApiErrorBody>(
      fail('VALIDATION_ERROR', 'x', [{ field: 'email', message: 'requis' }]),
    );
    expect(avec.error.details).toEqual([{ field: 'email', message: 'requis' }]);
  });
});

describe('parseBody', () => {
  const schema = z.object({ productId: z.string(), quantity: z.number().int().positive() });

  it('renvoie la donnée typée sur un corps valide', async () => {
    const resultat = await parseBody(
      requete(JSON.stringify({ productId: 'p1', quantity: 2 })),
      schema,
    );
    expect(resultat).toEqual({ ok: true, data: { productId: 'p1', quantity: 2 } });
  });

  it('distingue un JSON malformé d’un schéma violé', async () => {
    // Deux bugs différents côté client : l'un est un problème de sérialisation,
    // l'autre un contrat mal lu. Les confondre en 400 générique ne renseigne
    // personne.
    const malforme = await parseBody(requete('{ pas du json'), schema);
    expect(malforme.ok).toBe(false);
    if (malforme.ok) return;
    expect(malforme.response.status).toBe(400);
    expect((await corps<ApiErrorBody>(malforme.response)).error.code).toBe('INVALID_JSON');

    const invalide = await parseBody(requete(JSON.stringify({ productId: 'p1' })), schema);
    expect(invalide.ok).toBe(false);
    if (invalide.ok) return;
    expect(invalide.response.status).toBe(422);
    expect((await corps<ApiErrorBody>(invalide.response)).error.code).toBe('VALIDATION_ERROR');
  });

  it('traite un corps vide comme un JSON invalide', async () => {
    const resultat = await parseBody(requete(''), schema);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect((await corps<ApiErrorBody>(resultat.response)).error.code).toBe('INVALID_JSON');
  });

  it('nomme chaque champ fautif', async () => {
    const resultat = await parseBody(
      requete(JSON.stringify({ productId: 1, quantity: -1 })),
      schema,
    );
    if (resultat.ok) throw new Error('le schéma aurait dû être violé');
    const body = await corps<ApiErrorBody>(resultat.response);
    expect(body.error.details?.map((detail) => detail.field).sort()).toEqual([
      'productId',
      'quantity',
    ]);
  });

  it('désigne la racine quand l’erreur ne porte sur aucun champ', async () => {
    const resultat = await parseBody(requete(JSON.stringify(['pas un objet'])), schema);
    if (resultat.ok) throw new Error('le schéma aurait dû être violé');
    const body = await corps<ApiErrorBody>(resultat.response);
    expect(body.error.details?.[0]?.field).toBe('(root)');
  });
});

describe('parseQuery', () => {
  const schema = z.object({
    q: z.string().optional(),
    brand: z.union([z.string(), z.array(z.string())]).optional(),
  });

  it('replie une clé répétée en tableau, laisse l’unique en scalaire', () => {
    const params = new URLSearchParams('brand=Fender&brand=Gibson&q=strat');
    const resultat = parseQuery(params, schema);
    expect(resultat).toEqual({ ok: true, data: { brand: ['Fender', 'Gibson'], q: 'strat' } });
  });

  it('renvoie une 422 sur des paramètres invalides', async () => {
    const resultat = parseQuery(new URLSearchParams('q=1'), z.object({ q: z.number() }));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.response.status).toBe(422);
    expect((await corps<ApiErrorBody>(resultat.response)).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('enforceRateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    // Le facteur du mode test multiplierait le plafond et rendrait le refus
    // inatteignable dans ce test.
    vi.stubEnv('E2E_TEST_MODE', undefined);
  });

  afterEach(() => {
    resetRateLimits();
    vi.unstubAllEnvs();
  });

  it('renvoie null tant que le quota n’est pas épuisé', () => {
    const requete = new Request('https://exemple.fr/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(enforceRateLimit('login', requete)).toBeNull();
  });

  it('renseigne Retry-After et les en-têtes de quota au refus', async () => {
    // Un client renvoyé sans délai réessaie immédiatement — précisément le
    // trafic que la limite existe pour absorber.
    const requete = new Request('https://exemple.fr/api/auth/login', {
      headers: { 'x-forwarded-for': '198.51.100.9' },
    });
    let refus = null;
    for (let i = 0; i <= RATE_LIMITS.login.limit && refus === null; i += 1) {
      refus = enforceRateLimit('login', requete);
    }

    expect(refus).not.toBeNull();
    expect(refus!.status).toBe(429);
    expect(Number(refus!.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(refus!.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMITS.login.limit));
    expect(refus!.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect((await corps<ApiErrorBody>(refus!)).error.code).toBe('RATE_LIMITED');
  });
});

describe('gardes des endpoints de test', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('n’ouvre les endpoints que sur E2E_TEST_MODE=1', () => {
    vi.stubEnv('E2E_TEST_MODE', '1');
    expect(testEndpointsEnabled()).toBe(true);
    vi.stubEnv('E2E_TEST_MODE', 'true');
    expect(testEndpointsEnabled()).toBe(false);
    vi.stubEnv('E2E_TEST_MODE', undefined);
    expect(testEndpointsEnabled()).toBe(false);
  });

  it('compare le jeton à celui de l’environnement, avec un défaut de développement', () => {
    const avec = (jeton?: string) =>
      new Request('https://exemple.fr/api/test/reset', {
        headers: jeton ? { 'x-test-token': jeton } : {},
      });

    vi.stubEnv('TEST_API_TOKEN', undefined);
    expect(testTokenValid(avec('fretline-e2e-token'))).toBe(true);

    vi.stubEnv('TEST_API_TOKEN', 'jeton-du-run');
    expect(testTokenValid(avec('jeton-du-run'))).toBe(true);
    // Le cas qui produit les 403 opaques : un serveur oublié sur le port 3000
    // conserve l'ancien jeton.
    expect(testTokenValid(avec('fretline-e2e-token'))).toBe(false);
    expect(testTokenValid(avec())).toBe(false);
  });
});
