import { expect, test } from '@/fixtures/test-fixtures';
import { OrderBuilder } from '@/data/builders/OrderBuilder';
import { PRODUCTS } from '@/data/seed';
import { ProductPage } from '@/pages/ProductPage';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * The product page's detail tabs and its two suggestion blocks.
 *
 * The tabs are links carrying a query parameter, so every assertion here is on
 * served HTML — a tab is a shareable view of the page, not a client toggle.
 */
test.describe('Fiche produit — détails et suggestions', () => {
  test(
    'les caractéristiques sont l’onglet par défaut',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-480', 'Onglet par défaut'), covers('REQ-PDP-10')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.tabPanel).toHaveAttribute('data-tab', 'caracteristiques');
      await expect(productPage.tab('caracteristiques')).toHaveAttribute('data-active', 'true');
      await expect(productPage.specs).toBeVisible();
    },
  );

  test(
    'un onglet est partageable : il vit dans l’URL',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-481', 'Onglet dans l’URL'), covers('REQ-PDP-10')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await productPage.tab('livraison').click();
      await page.waitForURL(/onglet=livraison/);
      await expect(page.getByTestId('shipping-terms')).toBeVisible();

      // Reloading the URL lands on the same panel, which is what makes the tab
      // a view of the page rather than a transient toggle.
      await page.reload();
      await expect(productPage.tabPanel).toHaveAttribute('data-tab', 'livraison');
    },
  );

  test(
    'un onglet inconnu retombe sur les caractéristiques',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-482', 'Onglet inconnu'), covers('REQ-PDP-10')],
    },
    async ({ productPage }) => {
      // These URLs get hand-edited and shared; a stale one must degrade to the
      // default panel rather than to an empty page.
      await productPage.openProduct(PRODUCTS.inStock.slug, { onglet: 'telechargements' });

      await expect(productPage.tabPanel).toHaveAttribute('data-tab', 'caracteristiques');
    },
  );

  test(
    'les accessoires proposés viennent des rayons compatibles',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-483', 'Accessoires compatibles'), covers('REQ-PDP-11')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug, { onglet: 'accessoires' });

      await expect(productPage.accessories).not.toHaveCount(0);
      // An electric guitar never suggests another electric guitar: the block
      // answers "what goes with it", not "what else could I buy instead".
      const slugs = await ProductPage.slugsOf(productPage.accessories);
      expect(slugs).not.toContain(PRODUCTS.inStock.slug);
    },
  );

  test(
    'la suggestion d’accessoires est stable d’un chargement à l’autre',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-484', 'Ordre total des accessoires'), covers('REQ-PDP-11')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug, { onglet: 'accessoires' });
      const first = await ProductPage.slugsOf(productPage.accessories);

      await productPage.openProduct(PRODUCTS.inStock.slug, { onglet: 'accessoires' });
      const second = await ProductPage.slugsOf(productPage.accessories);

      // Best-seller and rating tie constantly across a catalogue this size;
      // without the id closing the order, the same page would suggest different
      // accessories from one request to the next.
      expect(second).toEqual(first);
    },
  );

  test(
    '« souvent acheté avec » n’apparaît pas sans commande le justifiant',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-485', 'Co-achat sans donnée'), covers('REQ-PDP-12')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.lowStock.slug);

      // Silence rather than a list nobody ever bought together.
      await expect(page.getByTestId('bought-together')).toHaveCount(0);
    },
  );

  test(
    'deux produits commandés ensemble se suggèrent l’un l’autre',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-486', 'Co-achat observé'), covers('REQ-PDP-12')],
    },
    async ({ productPage, api, registeredUser }) => {
      // `registeredUser` authenticates `api`: an order needs a customer, and a
      // guest one would need an e-mail the builder does not carry.
      expect(registeredUser.userId).toBeTruthy();
      await api.seed({
        stock: [
          { slug: PRODUCTS.coPurchaseA.slug, quantity: 5 },
          { slug: PRODUCTS.coPurchaseB.slug, quantity: 5 },
        ],
      });
      await api.addToCartAndTrack({ sku: PRODUCTS.coPurchaseA.sku, quantity: 1 });
      await api.addToCartAndTrack({ sku: PRODUCTS.coPurchaseB.sku, quantity: 1 });
      expect((await api.createOrder(new OrderBuilder().build())).status()).toBe(201);

      await productPage.openProduct(PRODUCTS.coPurchaseA.slug);

      // Read from `order_items`, so the block states something that actually
      // happened rather than a rule dressed up as an observation.
      expect(await ProductPage.slugsOf(productPage.boughtTogether)).toContain(
        PRODUCTS.coPurchaseB.slug,
      );
    },
  );
});
