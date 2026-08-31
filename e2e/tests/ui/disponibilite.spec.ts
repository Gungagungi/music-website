import { expect, test } from '@/fixtures/test-fixtures';
import { AVAILABILITY, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Availability and shipping delay.
 *
 * Everything asserted here is a pure function of the stock level, so these
 * specs arrange the stock and read the wording back. No date is involved on
 * either side: an estimated delivery date would change every night and turn a
 * stable page into a daily false regression.
 */
test.describe('Disponibilité et délai d’expédition', () => {
  test(
    'un produit disponible annonce son délai d’expédition',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-457', 'Délai d’expédition, produit disponible'), covers('REQ-PDP-08')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(productPage.availability).toHaveAttribute('data-availability', 'en-stock');
      await expect(page.getByTestId('product-shipping')).toHaveText(AVAILABILITY.shippingInStock);
    },
  );

  test(
    'une rupture annonce un réapprovisionnement plutôt qu’un simple « indisponible »',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-458', 'Délai de réapprovisionnement'), covers('REQ-PDP-08')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.outOfStock.slug);

      await expect(productPage.availability).toHaveAttribute('data-availability', 'rupture');
      await expect(page.getByTestId('product-shipping')).toHaveText(
        AVAILABILITY.shippingOutOfStock,
      );
      // Stating a restocking delay must not make an unavailable product look
      // orderable — the two statements answer different questions.
      await expect(productPage.addToCartButton).toBeDisabled();
    },
  );

  test(
    'un stock au seuil nomme le nombre d’unités restantes',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-459', 'Mention de stock faible'), covers('REQ-PDP-09')],
    },
    async ({ productPage, api }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.lowStock.slug, quantity: 2 }] });
      await productPage.openProduct(PRODUCTS.lowStock.slug);

      await expect(productPage.availability).toHaveAttribute('data-availability', 'stock-faible');
      await expect(productPage.availability).toContainText('Plus que 2 en stock');
    },
  );

  test(
    'juste au-dessus du seuil, la fiche ne compte plus les unités',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-460', 'Frontière du stock faible'), covers('REQ-PDP-09')],
    },
    async ({ productPage, api }) => {
      await api.seed({
        stock: [{ slug: PRODUCTS.lowStock.slug, quantity: AVAILABILITY.lowStockThreshold + 1 }],
      });
      await productPage.openProduct(PRODUCTS.lowStock.slug);

      // The boundary is the whole rule: one unit either side of it is what
      // distinguishes "En stock" from "Plus que 3 en stock".
      await expect(productPage.availability).toHaveAttribute('data-availability', 'en-stock');
      await expect(productPage.availability).not.toContainText('Plus que');
    },
  );

  test(
    'la carte du catalogue porte la même disponibilité que la fiche',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-461', 'Cohérence catalogue / fiche'), covers('REQ-PDP-09')],
    },
    async ({ catalogPage, page }) => {
      await catalogPage.openCategory('guitares-electriques');

      const card = page.locator(`[data-testid="product-card"][data-slug="${PRODUCTS.outOfStock.slug}"]`);
      await expect(card.getByTestId('product-availability')).toHaveAttribute(
        'data-availability',
        'rupture',
      );
    },
  );
});
