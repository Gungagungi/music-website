import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

const CATEGORY = CATEGORIES.electricGuitars.slug;

/** Facts about the seeded catalog this suite relies on. */
const ELECTRIC_GUITARS = {
  total: 13,
  fender: 2,
  gibson: 2,
  leftHanded: 1,
  onSale: 4,
  outOfStock: 2,
  ratedFourPlus: 9,
} as const;

test.describe('Catalogue — filtres à facettes', () => {
  test.beforeEach(async ({ catalogPage }) => {
    await catalogPage.openCategory(CATEGORY);
  });

  test(
    'affiche la catégorie complète sans filtre actif',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-020', 'Catalogue sans filtre'), covers('REQ-CAT-01')],
    },
    async ({ catalogPage }) => {
      await expect(catalogPage.heading).toHaveText(CATEGORIES.electricGuitars.label);
      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.total);
      await expect(catalogPage.activeFilterCount).toBeHidden();
      await expect(catalogPage.facets.root).toBeVisible();
    },
  );

  test(
    'filtrer par marque restreint les résultats et se reflète dans l’URL',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-021', 'Filtre marque'), covers('REQ-CAT-02')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Fender');

      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.fender);
      expect(catalogPage.searchParamAll('brand')).toEqual(['Fender']);

      // Every rendered card must really be a Fender — a count alone would pass
      // even if the filter returned the wrong two products.
      await expect(catalogPage.cards.getByTestId('product-brand')).toHaveText(['Fender', 'Fender']);
    },
  );

  test(
    'cumuler deux marques élargit la sélection',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-022', 'Filtre multi-marques'), covers('REQ-CAT-02')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Fender');
      await catalogPage.facets.selectBrand('Gibson');

      expect(await catalogPage.visibleResultCount()).toBe(
        ELECTRIC_GUITARS.fender + ELECTRIC_GUITARS.gibson,
      );
      expect(catalogPage.searchParamAll('brand').sort()).toEqual(['Fender', 'Gibson']);
    },
  );

  test(
    'décocher une marque la retire du filtre et de l’URL',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-023', 'Retrait d’un filtre marque'), covers('REQ-CAT-02')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Fender');
      await catalogPage.facets.selectBrand('Gibson');
      await catalogPage.facets.deselectBrand('Fender');

      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.gibson);
      expect(catalogPage.searchParamAll('brand')).toEqual(['Gibson']);
    },
  );

  test(
    'la fourchette de prix est saisie en euros et transmise en centimes',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-024', 'Filtre par prix'), covers('REQ-CAT-03')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.setPriceRange(1000, 2000);

      expect(catalogPage.searchParam('minPrice')).toBe('100000');
      expect(catalogPage.searchParam('maxPrice')).toBe('200000');

      const prices = await catalogPage.displayedPricesCents();
      expect(prices.length).toBeGreaterThan(0);
      for (const price of prices) {
        expect(price).toBeGreaterThanOrEqual(100000);
        expect(price).toBeLessThanOrEqual(200000);
      }
    },
  );

  test(
    '« en stock uniquement » masque les produits en rupture',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-025', 'Filtre disponibilité'), covers('REQ-CAT-04')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.toggleInStockOnly();

      expect(await catalogPage.visibleResultCount()).toBe(
        ELECTRIC_GUITARS.total - ELECTRIC_GUITARS.outOfStock,
      );
      await expect(catalogPage.cards.getByTestId('product-availability')).not.toContainText([
        'Rupture de stock',
      ]);
    },
  );

  test(
    '« en promotion » ne conserve que les produits remisés',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-026', 'Filtre promotions'), covers('REQ-CAT-04')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.toggleOnSaleOnly();

      const count = await catalogPage.visibleResultCount();
      expect(count).toBe(ELECTRIC_GUITARS.onSale);
      await expect(catalogPage.cards.getByTestId('product-discount')).toHaveCount(count);
    },
  );

  test(
    '« modèle gaucher » isole l’unique référence gauchère du rayon',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-027', 'Filtre gaucher'), covers('REQ-CAT-04')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.toggleLeftHandedOnly();

      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.leftHanded);
      expect(await catalogPage.displayedSlugs()).toEqual([PRODUCTS.leftHanded.slug]);
    },
  );

  test(
    'la note minimale écarte les produits moins bien notés',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-028', 'Filtre par note'), covers('REQ-CAT-05')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.setMinRating('4');

      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.ratedFourPlus);
      expect(catalogPage.searchParam('minRating')).toBe('4');
    },
  );

  test(
    'combiner plusieurs facettes affiche le compteur de filtres actifs',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-029', 'Cumul de filtres'), covers('REQ-CAT-06')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Gibson');
      await catalogPage.facets.toggleInStockOnly();

      await expect(catalogPage.activeFilterCount).toContainText('2 filtres actifs');
    },
  );

  test(
    '« tout effacer » ramène le rayon complet',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-030', 'Réinitialisation des filtres'), covers('REQ-CAT-07')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Fender');
      await catalogPage.facets.toggleInStockOnly();
      await catalogPage.facets.clearAllFilters();

      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.total);
      expect(catalogPage.searchParamAll('brand')).toEqual([]);
      expect(catalogPage.searchParam('inStock')).toBeNull();
    },
  );

  test(
    'une combinaison sans résultat affiche un état vide actionnable',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-031', 'Résultat vide'), covers('REQ-CAT-08')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.facets.setPriceRange(9000, 9500);

      await expect(catalogPage.emptyState).toBeVisible();
      await expect(catalogPage.cards).toHaveCount(0);
      expect(await catalogPage.visibleResultCount()).toBe(0);

      await catalogPage.emptyStateReset.click();
      await page.waitForURL((url) => url.search === '');
      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.total);
    },
  );

  test(
    'les filtres survivent à un rechargement de page',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-032', 'Persistance des filtres'), covers('REQ-CAT-09')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.facets.selectBrand('Gibson');
      await page.reload();

      // The state lives in the URL, not in component state — which is exactly
      // why a shared link reproduces the same view.
      await expect(catalogPage.facets.brandCheckbox('Gibson')).toBeChecked();
      expect(await catalogPage.visibleResultCount()).toBe(ELECTRIC_GUITARS.gibson);
    },
  );

  test(
    'une URL filtrée partagée reproduit exactement la même vue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-033', 'URL de filtre partageable'), covers('REQ-CAT-09')],
    },
    async ({ catalogPage }) => {
      await catalogPage.openCategory(CATEGORY, { brand: 'Gibson', inStock: 'true' });

      await expect(catalogPage.facets.brandCheckbox('Gibson')).toBeChecked();
      await expect(catalogPage.facets.inStockOnly).toBeChecked();
      await expect(catalogPage.activeFilterCount).toContainText('2 filtres actifs');
    },
  );
});
