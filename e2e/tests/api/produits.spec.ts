import { expect, test } from '@/fixtures/api-fixtures';
import {
  apiErrorSchema,
  brandListSchema,
  categoryListSchema,
  paginatedProductsSchema,
  productDetailSchema,
} from '@/api/schemas';
import { CATALOG_TOTAL_PRODUCTS, CATEGORIES, PRODUCTS, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — catalogue', () => {
  test(
    'GET /api/products respecte son contrat et pagine par défaut',
    {
      tag: [TAGS.smoke, TAGS.contract, TAGS.critical],
      annotation: [testCase('TC-210', 'Liste de produits'), covers('REQ-API-01')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.products(), paginatedProductsSchema);

      expect(body.total).toBe(CATALOG_TOTAL_PRODUCTS);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(RULES.defaultPageSize);
      expect(body.items).toHaveLength(RULES.defaultPageSize);
      expect(body.totalPages).toBe(Math.ceil(CATALOG_TOTAL_PRODUCTS / RULES.defaultPageSize));
    },
  );

  test(
    'le filtre par catégorie ne renvoie que le rayon demandé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-211', 'Filtre catégorie API'), covers('REQ-API-02')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.products({ category: CATEGORIES.effectPedals.slug, limit: 100 }),
        paginatedProductsSchema,
      );

      expect(body.items.length).toBeGreaterThan(0);
      for (const product of body.items) {
        expect(product.category).toBe(CATEGORIES.effectPedals.slug);
      }
    },
  );

  test(
    'la fourchette de prix est appliquée en centimes, bornes incluses',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-212', 'Filtre prix API'), covers('REQ-API-03')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.products({ minPrice: 10000, maxPrice: 50000, limit: 100 }),
        paginatedProductsSchema,
      );

      expect(body.items.length).toBeGreaterThan(0);
      for (const product of body.items) {
        expect(product.price).toBeGreaterThanOrEqual(10000);
        expect(product.price).toBeLessThanOrEqual(50000);
      }
    },
  );

  test(
    'le tri par prix est total : deux exécutions donnent le même ordre',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-213', 'Stabilité du tri'), covers('REQ-API-04')],
    },
    async ({ api }) => {
      const first = await api.expectOk(
        await api.products({ sort: 'prix-asc', limit: 100 }),
        paginatedProductsSchema,
      );
      const second = await api.expectOk(
        await api.products({ sort: 'prix-asc', limit: 100 }),
        paginatedProductsSchema,
      );

      const prices = first.items.map((product) => product.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));

      // The catalog contains several products sharing a price. Without a
      // tie-break the order is implementation-defined, and pagination silently
      // duplicates rows — so the ordering must be reproducible, not merely sorted.
      expect(first.items.map((product) => product.id)).toEqual(
        second.items.map((product) => product.id),
      );
    },
  );

  test(
    'la pagination ne duplique ni n’oublie de produit',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-214', 'Intégrité de la pagination API'), covers('REQ-API-05')],
    },
    async ({ api }) => {
      const collected: string[] = [];
      const limit = 20;

      for (let page = 1; page <= Math.ceil(CATALOG_TOTAL_PRODUCTS / limit); page += 1) {
        const body = await api.expectOk(
          await api.products({ sort: 'prix-asc', page, limit }),
          paginatedProductsSchema,
        );
        collected.push(...body.items.map((product) => product.id));
      }

      expect(collected).toHaveLength(CATALOG_TOTAL_PRODUCTS);
      expect(new Set(collected).size).toBe(CATALOG_TOTAL_PRODUCTS);
    },
  );

  test(
    'les filtres booléens se cumulent',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-215', 'Cumul de filtres API'), covers('REQ-API-06')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.products({ inStock: true, onSale: true, limit: 100 }),
        paginatedProductsSchema,
      );

      for (const product of body.items) {
        expect(product.stock).toBeGreaterThan(0);
        expect(product.discountPct).toBeGreaterThan(0);
      }
    },
  );

  test(
    'la recherche plein texte remonte le produit attendu',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-216', 'Recherche API'), covers('REQ-API-07')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.products({ q: PRODUCTS.inStock.sku }),
        paginatedProductsSchema,
      );

      expect(body.total).toBe(1);
      expect(body.items[0]?.slug).toBe(PRODUCTS.inStock.slug);
    },
  );

  test(
    'GET /api/products/:slug renvoie la fiche et ses avis',
    {
      tag: [TAGS.smoke, TAGS.contract],
      annotation: [testCase('TC-217', 'Détail produit'), covers('REQ-API-08')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.product(PRODUCTS.outOfStock.slug),
        productDetailSchema,
      );

      expect(body.slug).toBe(PRODUCTS.outOfStock.slug);
      expect(body.stock).toBe(0);
      expect(body.reviews.length).toBeGreaterThan(0);
    },
  );

  test(
    'une référence inconnue renvoie 404 avec le code attendu',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-218', 'Produit introuvable API'), covers('REQ-API-09')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.product('reference-inexistante'), apiErrorSchema, 404);
      expect(body.error.code).toBe('NOT_FOUND');
    },
  );

  test(
    'GET /api/categories expose les rayons et leur volumétrie',
    {
      tag: [TAGS.contract, TAGS.smoke],
      annotation: [testCase('TC-219', 'Liste des catégories'), covers('REQ-API-10')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.categories(), categoryListSchema);

      expect(body.items).toHaveLength(9);
      const totalFromCategories = body.items.reduce((sum, item) => sum + item.productCount, 0);
      expect(totalFromCategories).toBe(CATALOG_TOTAL_PRODUCTS);
    },
  );

  test(
    'GET /api/brands se restreint à la catégorie demandée',
    {
      tag: [TAGS.contract, TAGS.regression],
      annotation: [testCase('TC-220', 'Liste des marques'), covers('REQ-API-11')],
    },
    async ({ api }) => {
      const all = await api.expectOk(await api.brands(), brandListSchema);
      const scoped = await api.expectOk(
        await api.brands(CATEGORIES.strings.slug),
        brandListSchema,
      );

      expect(scoped.items.length).toBeGreaterThan(0);
      expect(scoped.items.length).toBeLessThan(all.items.length);
      expect(scoped.items.map((brand) => brand.name)).toEqual(
        [...scoped.items.map((brand) => brand.name)].sort((a, b) => a.localeCompare(b, 'fr')),
      );
    },
  );
});
