import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Panier', () => {
  test(
    'un panier préparé par l’API est repris par l’interface, totaux compris',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-100', 'Affichage du panier'), covers('REQ-CART-01')],
    },
    async ({ cartWith, cartPage }) => {
      // Arrange through the API: this spec is about *displaying* a cart, so the
      // clicks that fill one belong to the add-to-cart spec, not to this one.
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);

      await cartPage.open();

      await expect(cartPage.lines).toHaveCount(1);
      const line = cartPage.lineBySku(PRODUCTS.cheap.sku);
      await expect(line.quantity).toHaveValue('2');
      await expect(line.lineTotal).toShowPrice(PRODUCTS.cheap.priceCents * 2);

      await expect(cartPage.subtotal).toShowPrice(PRODUCTS.cheap.priceCents * 2);
      await expect(cartPage.header.cartCount).toHaveText('2');
    },
  );

  test(
    'un panier sous le seuil de gratuité se voit facturer les frais de port',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-101', 'Frais de port sous le seuil'), covers('REQ-CART-04')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await cartPage.open();

      const subtotal = PRODUCTS.cheap.priceCents;
      expect(subtotal, 'Le produit choisi doit rester sous le seuil de port offert.').toBeLessThan(
        RULES.freeShippingThresholdCents,
      );

      await expect(cartPage.shipping).toShowPrice(RULES.flatShippingCents);
      await expect(cartPage.total).toShowPrice(subtotal + RULES.flatShippingCents);
    },
  );

  test(
    'le panier vide propose un retour vers le catalogue',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-102', 'État vide du panier')],
    },
    async ({ cartPage }) => {
      await cartPage.open();

      await expect(cartPage.emptyState).toBeVisible();
      await expect(cartPage.emptyStateCta).toBeVisible();
      await expect(cartPage.lines).toHaveCount(0);
    },
  );
});
