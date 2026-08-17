import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Recherche', () => {
  test(
    'la barre de recherche du header mène aux résultats',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-050', 'Recherche depuis le header'), covers('REQ-SEARCH-01')],
    },
    async ({ homePage, searchPage, page }) => {
      await homePage.open();
      await homePage.header.search('stratocaster');
      await page.waitForURL('**/recherche?q=stratocaster');

      await expect(searchPage.heading).toContainText('stratocaster');
      expect(await searchPage.visibleResultCount()).toBeGreaterThan(0);
    },
  );

  test(
    'la recherche par marque remonte les produits du fabricant',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-051', 'Recherche par marque'), covers('REQ-SEARCH-02')],
    },
    async ({ searchPage }) => {
      await searchPage.searchFor('Gibson');

      const count = await searchPage.visibleResultCount();
      expect(count).toBeGreaterThan(0);
      await expect(searchPage.cards.getByTestId('product-brand')).toHaveText(
        Array.from({ length: Math.min(count, 12) }, () => 'Gibson'),
      );
    },
  );

  test(
    'la recherche par référence produit trouve l’article exact',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-052', 'Recherche par SKU'), covers('REQ-SEARCH-02')],
    },
    async ({ searchPage }) => {
      await searchPage.searchFor(PRODUCTS.inStock.sku);

      expect(await searchPage.visibleResultCount()).toBe(1);
      await expect(searchPage.card(0).name).toHaveText(PRODUCTS.inStock.name);
    },
  );

  test(
    'la recherche ignore la casse et les accents',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-053', 'Normalisation de la recherche'), covers('REQ-SEARCH-03')],
    },
    async ({ searchPage }) => {
      await searchPage.searchFor('pédales');
      const accented = await searchPage.visibleResultCount();

      await searchPage.searchFor('PEDALES');
      const plain = await searchPage.visibleResultCount();

      expect(plain).toBe(accented);
      expect(plain).toBeGreaterThan(0);
    },
  );

  test(
    'plusieurs mots-clés se cumulent au lieu de s’additionner',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-054', 'Recherche multi-termes'), covers('REQ-SEARCH-04')],
    },
    async ({ searchPage }) => {
      await searchPage.searchFor('fender');
      const brandOnly = await searchPage.visibleResultCount();

      await searchPage.searchFor('fender telecaster');
      const narrowed = await searchPage.visibleResultCount();

      expect(narrowed).toBeGreaterThan(0);
      expect(narrowed).toBeLessThan(brandOnly);
    },
  );

  test(
    'une recherche sans résultat propose une piste de correction',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-055', 'Recherche sans résultat'), covers('REQ-SEARCH-05')],
    },
    async ({ searchPage }) => {
      await searchPage.searchFor('cornemuse électrique');

      await expect(searchPage.emptyState).toBeVisible();
      await expect(searchPage.cards).toHaveCount(0);
      expect(await searchPage.visibleResultCount()).toBe(0);
    },
  );

  test(
    'la page de recherche sans terme invite à saisir une requête',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-056', 'Recherche vide'), covers('REQ-SEARCH-05')],
    },
    async ({ searchPage }) => {
      await searchPage.open();

      await expect(searchPage.prompt).toBeVisible();
      await expect(searchPage.cards).toHaveCount(0);
    },
  );

  test(
    'les résultats de recherche se trient comme le catalogue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-057', 'Tri des résultats de recherche'), covers('REQ-SEARCH-06')],
    },
    async ({ searchPage, page }) => {
      await searchPage.searchFor('guitare');
      await searchPage.sortSelect.selectOption('prix-asc');
      await page.waitForURL((url) => url.searchParams.get('sort') === 'prix-asc');

      await expect(searchPage.cards.getByTestId('product-price')).toBeSortedByPrice('asc');
      // The search term must survive the sort — losing it would silently widen
      // the result set.
      expect(searchPage.searchParam('q')).toBe('guitare');
    },
  );
});
