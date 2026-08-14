import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, cartSchema, paginatedProductsSchema } from '@/api/schemas';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Negative and abuse cases.
 *
 * These are the tests that matter most in an e-commerce API: the happy path is
 * exercised by every other suite and by every manual click-through, whereas a
 * missing server-side check is invisible right up to the moment someone finds it.
 */
test.describe('API — robustesse et sécurité', () => {
  test(
    'un corps JSON malformé est distingué d’un corps invalide',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-290', 'JSON malformé'), covers('REQ-API-60')],
    },
    async ({ request }) => {
      // A Buffer is sent byte for byte. Passing a string here would let
      // Playwright re-encode it as a JSON *string*, which parses fine and would
      // have made this test pass against the wrong behaviour.
      const response = await request.post('/api/auth/login', {
        headers: { 'content-type': 'application/json' },
        data: Buffer.from('{"email": "test@fretline.test", "password":', 'utf8'),
      });

      // 400 for "this is not JSON", 422 for "this is JSON but wrong" — two
      // different client bugs that deserve two different answers.
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_JSON');
    },
  );

  test(
    'un type de champ incorrect est rejeté par la validation',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-291', 'Type de champ incorrect'), covers('REQ-API-60')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.postRaw('/api/cart/items', { sku: PRODUCTS.cheap.sku, quantity: 'deux' }),
        apiErrorSchema,
        422,
      );
      expect(body.error.details?.some((detail) => detail.field === 'quantity')).toBe(true);
    },
  );

  test(
    'une quantité négative est refusée',
    {
      tag: [TAGS.regression, TAGS.security, TAGS.critical],
      annotation: [testCase('TC-292', 'Quantité négative'), covers('REQ-SEC-08')],
    },
    async ({ api }) => {
      // A negative quantity that slipped through would let a cart total go down
      // as items are added — the classic e-commerce free-money bug.
      const body = await api.expectOk(
        await api.postRaw('/api/cart/items', { sku: PRODUCTS.cheap.sku, quantity: -3 }),
        apiErrorSchema,
        422,
      );
      expect(body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  test(
    'un prix envoyé par le client est ignoré au profit du prix catalogue',
    {
      tag: [TAGS.security, TAGS.critical],
      annotation: [testCase('TC-293', 'Falsification du prix'), covers('REQ-SEC-09')],
    },
    async ({ api }) => {
      const cart = await api.expectOk(
        await api.postRaw('/api/cart/items', {
          sku: PRODUCTS.inStock.sku,
          quantity: 1,
          unitPrice: 1,
          price: 1,
          lineTotal: 1,
        }),
        cartSchema,
        201,
      );

      expect(cart.items[0]?.unitPrice).toBe(PRODUCTS.inStock.priceCents);
      expect(cart.totals.subtotal).toBe(PRODUCTS.inStock.priceCents);
    },
  );

  test(
    'une pagination hors bornes est refusée plutôt que silencieusement corrigée',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-294', 'Limite de pagination'), covers('REQ-API-61')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.products({ limit: 5000 }), apiErrorSchema, 422);
      expect(body.error.details?.[0]?.field).toBe('limit');
    },
  );

  test(
    'une page au-delà du dernier résultat renvoie une liste vide, pas une erreur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-295', 'Page au-delà des résultats'), covers('REQ-API-61')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.products({ page: 999 }), paginatedProductsSchema);
      expect(body.items).toHaveLength(0);
      expect(body.total).toBeGreaterThan(0);
    },
  );

  test(
    'une valeur d’énumération inconnue est rejetée',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-296', 'Tri inconnu'), covers('REQ-API-61')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.productsRaw('sort=par-couleur-preferee'),
        apiErrorSchema,
        422,
      );
      expect(body.error.details?.[0]?.field).toBe('sort');
    },
  );

  test(
    'une charge utile de type injection est traitée comme du texte inoffensif',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-297', 'Charges utiles hostiles'), covers('REQ-SEC-10')],
    },
    async ({ api }) => {
      const payloads = [
        "'; DROP TABLE products; --",
        '<script>alert(1)</script>',
        '../../etc/passwd',
        '{{7*7}}',
      ];

      for (const payload of payloads) {
        const body = await api.expectOk(await api.products({ q: payload }), paginatedProductsSchema);
        // No crash, no leak, no reflected execution — just an empty result set.
        expect(body.total).toBe(0);
      }
    },
  );

  test(
    'un jeton d’authentification falsifié est rejeté',
    {
      tag: [TAGS.security, TAGS.critical],
      annotation: [testCase('TC-298', 'Jeton falsifié'), covers('REQ-SEC-11')],
    },
    async ({ api }) => {
      const forged =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJVU1ItMDAwMSIsImlzcyI6ImZyZXRsaW5lIn0.signature-bidon';

      const body = await api.withToken(forged).expectOk(await api.me(), apiErrorSchema, 401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'les endpoints de test exigent le jeton partagé',
    {
      tag: [TAGS.security, TAGS.critical],
      annotation: [testCase('TC-299', 'Protection des hooks de test'), covers('REQ-SEC-12')],
    },
    async ({ request }) => {
      const withoutToken = await request.post('/api/test/reset');
      expect(withoutToken.status()).toBe(403);

      const wrongToken = await request.post('/api/test/reset', {
        headers: { 'x-test-token': 'mauvais-jeton' },
      });
      expect(wrongToken.status()).toBe(403);
    },
  );

  test(
    'une route inconnue renvoie 404 sans divulguer la pile',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-300', 'Route inconnue'), covers('REQ-SEC-13')],
    },
    async ({ request }) => {
      const response = await request.get('/api/cette-route-nexiste-pas');

      expect(response.status()).toBe(404);
      const text = await response.text();
      expect(text).not.toContain('at Object.');
      expect(text.toLowerCase()).not.toContain('stack');
    },
  );

  test(
    'le profil utilisateur ne divulgue jamais le hachage du mot de passe',
    {
      tag: [TAGS.security, TAGS.contract, TAGS.critical],
      annotation: [testCase('TC-301', 'Non-divulgation du hachage'), covers('REQ-SEC-14')],
    },
    async ({ authedApi }) => {
      const response = await authedApi.me();
      const raw = await response.text();

      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toContain('scrypt');
    },
  );
});
