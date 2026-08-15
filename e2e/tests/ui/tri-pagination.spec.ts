import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

const CATEGORY = CATEGORIES.electricGuitars.slug;
const TOTAL_ELECTRIC_GUITARS = 13;

test.describe('Catalogue — tri et pagination', () => {
  test.beforeEach(async ({ catalogPage }) => {
    await catalogPage.openCategory(CATEGORY);
  });

  test(
    'le tri par prix croissant ordonne réellement les résultats',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-040', 'Tri prix croissant'), covers('REQ-SORT-01')],
    },
    async ({ catalogPage }) => {
      await catalogPage.sortBy('prix-asc');

      await expect(catalogPage.prices).toBeSortedByPrice('asc');
      expect(catalogPage.searchParam('sort')).toBe('prix-asc');
    },
  );

  test(
    'le tri par prix décroissant ordonne réellement les résultats',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-041', 'Tri prix décroissant'), covers('REQ-SORT-01')],
    },
    async ({ catalogPage }) => {
      await catalogPage.sortBy('prix-desc');
      await expect(catalogPage.prices).toBeSortedByPrice('desc');
    },
  );

  test(
    'le tri par note place les mieux notés en tête',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-042', 'Tri par note'), covers('REQ-SORT-02')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.sortBy('note');

      const ratings = await page
        .getByTestId('product-card')
        .getByTestId('rating')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const match = /(\d[.,]\d)\s*\(/.exec(node.textContent ?? '');
            return match ? Number.parseFloat(match[1]!.replace(',', '.')) : 0;
          }),
        );

      const sorted = [...ratings].sort((a, b) => b - a);
      expect(ratings).toEqual(sorted);
    },
  );

  test(
    'revenir à « pertinence » retire le paramètre de tri de l’URL',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-043', 'Retour au tri par défaut')],
    },
    async ({ catalogPage }) => {
      await catalogPage.sortBy('prix-asc');
      await catalogPage.sortBy('pertinence');

      expect(catalogPage.searchParam('sort')).toBeNull();
    },
  );

  test(
    'la pagination découpe le rayon selon la taille de page',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-044', 'Pagination — découpage'), covers('REQ-PAGE-01')],
    },
    async ({ catalogPage }) => {
      await expect(catalogPage.pagination).toBeVisible();
      await expect(catalogPage.cards).toHaveCount(RULES.defaultPageSize);

      await catalogPage.goToPage(2);
      await expect(catalogPage.cards).toHaveCount(TOTAL_ELECTRIC_GUITARS - RULES.defaultPageSize);
    },
  );

  test(
    'aucun produit n’est dupliqué ni oublié entre les deux pages',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-045', 'Pagination — intégrité'), covers('REQ-PAGE-02')],
    },
    async ({ catalogPage }) => {
      // Sorting by price is the case where an incomplete ordering shows up: with
      // ties and no tie-break, a product can appear on both pages while another
      // appears on neither.
      await catalogPage.sortBy('prix-asc');

      const firstPage = await catalogPage.displayedSlugs();
      await catalogPage.goToPage(2);
      const secondPage = await catalogPage.displayedSlugs();

      const all = [...firstPage, ...secondPage];
      expect(new Set(all).size, 'Un produit apparaît sur les deux pages.').toBe(all.length);
      expect(all.length).toBe(TOTAL_ELECTRIC_GUITARS);
    },
  );

  test(
    'le tri est conservé en changeant de page',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-046', 'Persistance du tri en pagination'), covers('REQ-PAGE-03')],
    },
    async ({ catalogPage }) => {
      await catalogPage.sortBy('prix-desc');
      await catalogPage.goToPage(2);

      expect(catalogPage.searchParam('sort')).toBe('prix-desc');
      await expect(catalogPage.sortSelect).toHaveValue('prix-desc');
    },
  );

  test(
    'appliquer un filtre depuis la page 2 renvoie à la page 1',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-047', 'Réinitialisation de page au filtrage'), covers('REQ-PAGE-04')],
    },
    async ({ catalogPage }) => {
      await catalogPage.goToPage(2);
      expect(catalogPage.searchParam('page')).toBe('2');

      await catalogPage.facets.selectBrand('Gibson');

      // Staying on page 4 of a result set that now has one page is a dead end
      // the shopper cannot escape without editing the URL.
      expect(catalogPage.searchParam('page')).toBeNull();
      await expect(catalogPage.cards.first()).toBeVisible();
    },
  );

  test(
    'la pagination disparaît quand les résultats tiennent sur une page',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-048', 'Pagination masquée')],
    },
    async ({ catalogPage }) => {
      await catalogPage.facets.selectBrand('Gibson');
      await expect(catalogPage.pagination).toBeHidden();
    },
  );
});
