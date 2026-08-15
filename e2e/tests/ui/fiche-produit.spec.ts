import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, PRODUCTS, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Fiche produit', () => {
  test(
    'présente l’identité, le prix et la disponibilité du produit',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-060', 'Contenu de la fiche produit'), covers('REQ-PDP-01')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.heading).toHaveText(PRODUCTS.inStock.name);
      await expect(productPage.sku).toContainText(PRODUCTS.inStock.sku);
      await expect(productPage.price).toShowPrice(PRODUCTS.inStock.priceCents);
      await expect(productPage.availability).toContainText('En stock');
      await expect(productPage.image).toBeVisible();
      await expect(productPage.description).not.toBeEmpty();
    },
  );

  test(
    'affiche le tableau de caractéristiques',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-061', 'Caractéristiques produit'), covers('REQ-PDP-02')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.specs).toBeVisible();
      await expect(productPage.specs.getByRole('term')).not.toHaveCount(0);
      await expect(productPage.specValue('Corps')).toHaveText('Acajou');
    },
  );

  test(
    'le fil d’Ariane reflète la hiérarchie du catalogue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-062', 'Fil d’Ariane'), covers('REQ-NAV-02')],
    },
    async ({ productPage, catalogPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      const breadcrumb = page.getByTestId('breadcrumb');
      await expect(breadcrumb).toContainText(CATEGORIES.electricGuitars.label);

      await breadcrumb.getByRole('link', { name: CATEGORIES.electricGuitars.label }).click();
      await page.waitForURL(`**/c/${CATEGORIES.electricGuitars.slug}`);
      await expect(catalogPage.heading).toHaveText(CATEGORIES.electricGuitars.label);
    },
  );

  test(
    'un produit remisé montre le prix barré et le pourcentage',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-063', 'Affichage d’une promotion'), covers('REQ-PDP-03')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.cheap.slug);

      await expect(productPage.listPrice).toBeVisible();
      await expect(productPage.discountBadge).toContainText('%');

      const price = Number.parseInt(
        (await productPage.availability.getAttribute('data-stock')) ?? '1',
        10,
      );
      expect(price, 'Le produit de référence doit rester en stock.').toBeGreaterThan(0);
    },
  );

  test(
    'un produit en rupture désactive l’ajout au panier',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-064', 'Produit indisponible'), covers('REQ-PDP-04')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.outOfStock.slug);

      await expect(productPage.availability).toContainText('Rupture de stock');
      await expect(productPage.addToCartButton).toBeDisabled();
      await expect(productPage.addToCartButton).toHaveText('Produit indisponible');
    },
  );

  test(
    'un modèle gaucher porte son badge',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-065', 'Badge gaucher')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.leftHanded.slug);
      await expect(productPage.leftHandedBadge).toBeVisible();
    },
  );

  test(
    'la note affichée distingue l’historique complet des avis détaillés',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-066', 'Cohérence note / avis'), covers('REQ-PDP-05')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.outOfStock.slug);

      const summary = page.getByTestId('reviews-summary');
      await expect(summary).toContainText('avis détaillé');
      await expect(productPage.reviews).toHaveCount(2);
    },
  );

  test(
    'ajouter au panier confirme l’action et met à jour le compteur',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-067', 'Ajout au panier'), covers('REQ-CART-02')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      const outcome = await productPage.addToCart({ quantity: 2 });

      expect(outcome).toBe('success');
      await expect(productPage.addToCartStatus).toContainText(PRODUCTS.inStock.name);
      await expect(productPage.header.cartCount).toHaveText('2');
    },
  );

  test(
    'le coloris choisi est repris dans le panier',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-068', 'Choix du coloris'), covers('REQ-CART-03')],
    },
    async ({ productPage, cartPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await productPage.addToCart({ color: 'Ebony' });

      await cartPage.open();
      await expect(cartPage.lineBySku(PRODUCTS.inStock.sku).color).toContainText('Ebony');
    },
  );

  test(
    'la quantité est plafonnée par ligne de commande',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-069', 'Quantité maximale'), covers('REQ-CART-05')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.quantityInput).toHaveAttribute(
        'max',
        String(RULES.maxQuantityPerLine),
      );
    },
  );

  test(
    'les produits du même rayon sont proposés en bas de fiche',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-070', 'Produits associés'), covers('REQ-PDP-06')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.relatedProducts).not.toHaveCount(0);
      // A "related" block that suggests the product you are already looking at
      // is the kind of detail nobody notices until a customer does.
      const slugs = await productPage.relatedProducts.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-slug')),
      );
      expect(slugs).not.toContain(PRODUCTS.inStock.slug);
    },
  );

  test(
    'une référence inexistante renvoie une page 404',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-071', 'Produit introuvable'), covers('REQ-PDP-07')],
    },
    async ({ page }) => {
      const response = await page.goto('/p/guitare-qui-nexiste-pas');

      expect(response?.status()).toBe(404);
      await expect(page.getByTestId('not-found')).toBeVisible();
    },
  );
});
