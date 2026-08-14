import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Comparateur', () => {
  test(
    'compare deux produits colonne par colonne',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-140', 'Comparaison de deux produits'), covers('REQ-CMP-01')],
    },
    async ({ comparePage }) => {
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.leftHanded.slug]);

      await expect(comparePage.table).toBeVisible();
      expect(await comparePage.comparedSlugs()).toEqual([
        PRODUCTS.inStock.slug,
        PRODUCTS.leftHanded.slug,
      ]);
      await expect(comparePage.row('Prix')).toBeVisible();
      await expect(comparePage.row('Disponibilité')).toBeVisible();
    },
  );

  test(
    'la comparaison est plafonnée à trois produits',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-141', 'Limite du comparateur'), covers('REQ-CMP-02')],
    },
    async ({ comparePage }) => {
      await comparePage.compare([
        PRODUCTS.inStock.slug,
        PRODUCTS.leftHanded.slug,
        PRODUCTS.outOfStock.slug,
        PRODUCTS.cheap.slug,
      ]);

      await expect(comparePage.columns).toHaveCount(3);
      expect(await comparePage.comparedSlugs()).not.toContain(PRODUCTS.cheap.slug);
    },
  );

  test(
    'les caractéristiques absentes d’un modèle sont explicitement vides',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-142', 'Caractéristiques hétérogènes'), covers('REQ-CMP-03')],
    },
    async ({ comparePage }) => {
      // A guitar and a pedal share almost no spec keys, so the union of rows
      // must show a placeholder rather than an empty cell.
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.cheap.slug]);

      await expect(comparePage.table.getByText('—').first()).toBeVisible();
    },
  );

  test(
    'retirer un produit met à jour le comparateur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-143', 'Retrait du comparateur')],
    },
    async ({ comparePage, page }) => {
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.leftHanded.slug]);

      await comparePage.columns.first().getByTestId('compare-remove').click();
      await page.waitForURL((url) => !url.searchParams.get('refs')?.includes(PRODUCTS.inStock.slug));

      expect(await comparePage.comparedSlugs()).toEqual([PRODUCTS.leftHanded.slug]);
    },
  );

  test(
    'le comparateur vide explique comment y ajouter des produits',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-144', 'Comparateur vide')],
    },
    async ({ comparePage }) => {
      await comparePage.open();

      await expect(comparePage.emptyState).toBeVisible();
      await expect(comparePage.table).toBeHidden();
    },
  );

  test(
    'le lien « comparer » de la fiche produit alimente le comparateur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-145', 'Ajout au comparateur depuis la fiche'), covers('REQ-CMP-01')],
    },
    async ({ productPage, comparePage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await productPage.compareLink.click();
      await page.waitForURL('**/comparateur**');

      expect(await comparePage.comparedSlugs()).toEqual([PRODUCTS.inStock.slug]);
    },
  );
});
