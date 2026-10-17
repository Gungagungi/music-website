import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Buying guides, and the "recently viewed" row.
 *
 * The guides are static content with no per-visitor state, so their assertions
 * are about routing and about the links that tie them back to the catalogue.
 */
test.describe('Guides d’achat', () => {
  test(
    'la liste des guides est atteignable depuis le pied de page',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-497', 'Accès aux guides'), covers('REQ-GUIDE-01')],
    },
    async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('footer-guides').click();
      await page.waitForURL('**/guides');

      await expect(page.getByTestId('guides-title')).toBeVisible();
      await expect(page.getByTestId('guide-card')).not.toHaveCount(0);
    },
  );

  test(
    'un guide ramène au rayon qu’il décrit',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-498', 'Guide relié à son rayon'), covers('REQ-GUIDE-02')],
    },
    async ({ page, catalogPage }) => {
      await page.goto('/guides');
      await page.getByTestId('guide-card').first().getByRole('link').click();
      await page.waitForURL(/\/guides\/[a-z-]+$/);

      await expect(page.getByTestId('guide-section')).not.toHaveCount(0);
      // A guide that does not lead back to the products it describes is a blog
      // post, not a buying guide.
      await expect(page.getByTestId('guide-products')).toBeVisible();

      await page.getByTestId('guide-category-link').click();
      await page.waitForURL(/\/c\//);
      await expect(catalogPage.heading).toBeVisible();
    },
  );

  test(
    'un rayon met en avant le guide écrit pour lui',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-499', 'Guide depuis le rayon'), covers('REQ-GUIDE-02')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory(CATEGORIES.electricGuitars.slug);

      await expect(page.getByTestId('category-guide-link').first()).toBeVisible();
    },
  );

  test(
    'un guide inexistant renvoie une page 404',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-500', 'Guide inconnu'), covers('REQ-GUIDE-01')],
    },
    async ({ page }) => {
      const response = await page.goto('/guides/ce-guide-n-existe-pas');

      expect(response?.status()).toBe(404);
    },
  );
});

test.describe('Vus récemment', () => {
  test(
    'la fiche consultée apparaît sur la suivante, jamais sur elle-même',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-501', 'Historique de consultation'), covers('REQ-GUIDE-03')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      // "Vus récemment" listing the page you are on says nothing, so the block
      // is absent on the very first visit.
      await expect(page.getByTestId('recently-viewed')).toHaveCount(0);

      await productPage.openProduct(PRODUCTS.cheap.slug);

      const row = page.getByTestId('recently-viewed');
      await expect(row).toBeVisible();
      await expect(
        row.locator(`[data-testid="product-card"][data-slug="${PRODUCTS.inStock.slug}"]`),
      ).toBeVisible();
      await expect(
        row.locator(`[data-testid="product-card"][data-slug="${PRODUCTS.cheap.slug}"]`),
      ).toHaveCount(0);
    },
  );

  test(
    'revoir un produit le remonte au lieu de le dupliquer',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-502', 'Ordre de l’historique'), covers('REQ-GUIDE-03')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.strings.slug);
      await productPage.openProduct(PRODUCTS.leftHanded.slug);
      await productPage.openProduct(PRODUCTS.strings.slug);
      await productPage.openProduct(PRODUCTS.lowStock.slug);

      const row = page.getByTestId('recently-viewed');
      await expect(
        row.locator(`[data-testid="product-card"][data-slug="${PRODUCTS.strings.slug}"]`),
      ).toHaveCount(1);
    },
  );
});
