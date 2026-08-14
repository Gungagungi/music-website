import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { stabilise } from '@/utils/visual';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Visual regression on components, not on full pages.
 *
 * A whole-page baseline fails whenever anything anywhere changes, which trains
 * everyone to run `--update-snapshots` without looking. Component-level
 * baselines fail for one reason each, so a diff is worth reading.
 *
 * Regenerate deliberately with:
 *   npm run test:visual -w e2e -- --update-snapshots
 */
test.describe('Régression visuelle', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test(
    'en-tête du site',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-330', 'Baseline — en-tête'), covers('REQ-VIS-01')],
    },
    async ({ homePage, page }) => {
      await homePage.open();
      await stabilise(page);

      await expect(homePage.header.root).toHaveScreenshot('header.png');
    },
  );

  test(
    'bandeau d’accueil',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-331', 'Baseline — hero'), covers('REQ-VIS-01')],
    },
    async ({ homePage, page }) => {
      await homePage.open();
      await stabilise(page);

      await expect(homePage.hero).toHaveScreenshot('hero.png');
    },
  );

  test(
    'carte produit avec promotion',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-332', 'Baseline — carte produit'), covers('REQ-VIS-02')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory(CATEGORIES.effectPedals.slug);
      await stabilise(page);

      await expect(catalogPage.cardBySlug(PRODUCTS.cheap.slug).root).toHaveScreenshot(
        'product-card-promo.png',
      );
    },
  );

  test(
    'carte produit en rupture de stock',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-333', 'Baseline — carte en rupture'), covers('REQ-VIS-02')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory(CATEGORIES.electricGuitars.slug);
      await stabilise(page);

      await expect(catalogPage.cardBySlug(PRODUCTS.outOfStock.slug).root).toHaveScreenshot(
        'product-card-rupture.png',
      );
    },
  );

  test(
    'panneau de facettes',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-334', 'Baseline — panneau de filtres'), covers('REQ-VIS-03')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory(CATEGORIES.strings.slug);
      await stabilise(page);

      await expect(catalogPage.facets.root).toHaveScreenshot('facet-panel.png');
    },
  );

  test(
    'bloc d’achat de la fiche produit',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-335', 'Baseline — bloc d’achat'), covers('REQ-VIS-04')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await stabilise(page);

      await expect(page.getByTestId('product-buybox')).toHaveScreenshot('product-buybox.png');
    },
  );

  test(
    'récapitulatif du panier avec remise',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-336', 'Baseline — récapitulatif panier'), covers('REQ-VIS-05')],
    },
    async ({ cartWith, cartPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();
      await cartPage.applyCoupon('BIENVENUE10');
      await expect(cartPage.appliedCoupon).toBeVisible();
      await stabilise(page);

      await expect(cartPage.summary).toHaveScreenshot('cart-summary-discount.png');
    },
  );

  test(
    'état vide du panier',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-337', 'Baseline — panier vide'), covers('REQ-VIS-06')],
    },
    async ({ cartPage, page }) => {
      await cartPage.open();
      await stabilise(page);

      await expect(cartPage.emptyState).toHaveScreenshot('cart-empty.png');
    },
  );

  test(
    'état vide du catalogue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-338', 'Baseline — catalogue vide'), covers('REQ-VIS-06')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory(CATEGORIES.electricGuitars.slug, {
        minPrice: '900000',
        maxPrice: '950000',
      });
      await stabilise(page);

      await expect(catalogPage.emptyState).toHaveScreenshot('catalog-empty.png');
    },
  );

  test(
    'pied de page',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-339', 'Baseline — pied de page'), covers('REQ-VIS-01')],
    },
    async ({ homePage, page }) => {
      await homePage.open();
      await stabilise(page);

      await expect(page.getByTestId('site-footer')).toHaveScreenshot('footer.png');
    },
  );
});
