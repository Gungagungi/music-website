import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, wishlistSchema } from '@/api/schemas';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Favourites.
 *
 * Every spec here arranges its own account, so two of them saving the same
 * product cannot interfere — the row is keyed on (product, user).
 */
test.describe('API — favoris', () => {
  test(
    'enregistrer un favori exige une authentification',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-487', 'Favori sans authentification'), covers('REQ-API-62')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.saveToWishlist(PRODUCTS.inStock.slug),
        apiErrorSchema,
        401,
      );
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'un favori enregistré deux fois n’apparaît qu’une fois',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-488', 'Enregistrement idempotent'), covers('REQ-API-63')],
    },
    async ({ authedApi }) => {
      // Clicking a heart twice is a double-click, not a request for two copies.
      expect((await authedApi.saveToWishlist(PRODUCTS.inStock.slug)).status()).toBe(201);
      expect((await authedApi.saveToWishlist(PRODUCTS.inStock.slug)).status()).toBe(201);

      const mine = await authedApi.expectOk(await authedApi.wishlist(), wishlistSchema);
      expect(mine.items.filter((product) => product.slug === PRODUCTS.inStock.slug)).toHaveLength(1);
    },
  );

  test(
    'un favori peut être retiré, et le retirer deux fois échoue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-489', 'Retrait d’un favori'), covers('REQ-API-63')],
    },
    async ({ authedApi }) => {
      await authedApi.saveToWishlist(PRODUCTS.cheap.slug);

      expect((await authedApi.removeFromWishlist(PRODUCTS.cheap.slug)).status()).toBe(200);

      const body = await authedApi.expectOk(
        await authedApi.removeFromWishlist(PRODUCTS.cheap.slug),
        apiErrorSchema,
        404,
      );
      expect(body.error.code).toBe('NOT_FOUND');
    },
  );

  test(
    'un client ne voit que ses propres favoris',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-490', 'Cloisonnement des favoris'), covers('REQ-API-64')],
    },
    async ({ authedApi, otherAuthedApi }) => {
      await authedApi.saveToWishlist(PRODUCTS.strings.slug);

      const theirs = await otherAuthedApi.expectOk(await otherAuthedApi.wishlist(), wishlistSchema);

      expect(theirs.items.some((product) => product.slug === PRODUCTS.strings.slug)).toBe(false);
    },
  );

  test(
    'un favori reflète l’état du jour, pas celui de l’enregistrement',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-491', 'Favori et état courant'), covers('REQ-API-63')],
    },
    async ({ api, authedApi }) => {
      await authedApi.saveToWishlist(PRODUCTS.wishlistTarget.slug);
      await api.seed({ stock: [{ slug: PRODUCTS.wishlistTarget.slug, quantity: 7 }] });

      // The opposite choice from an order line, deliberately: an order records
      // what was bought at a price, a wish list points at what is on sale now —
      // a restock or a price cut has to show through, and that is most of its
      // value.
      const mine = await authedApi.expectOk(await authedApi.wishlist(), wishlistSchema);
      expect(mine.items.find((product) => product.slug === PRODUCTS.wishlistTarget.slug)?.stock).toBe(
        7,
      );
    },
  );
});
