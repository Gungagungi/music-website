import { expect, test } from '@/fixtures/test-fixtures';
import { COUPONS, PRODUCTS, RULES } from '@/data/seed';
import { percentOf, vatIncludedIn } from '@/utils/money';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Panier — contenu', () => {
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

  test(
    'modifier la quantité recalcule la ligne et le total',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-103', 'Modification de quantité'), covers('REQ-CART-06')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await cartPage.open();

      await cartPage.line(0).setQuantity(3);

      await expect(cartPage.line(0).lineTotal).toShowPrice(PRODUCTS.cheap.priceCents * 3);
      await expect(cartPage.subtotal).toShowPrice(PRODUCTS.cheap.priceCents * 3);
      await expect(cartPage.header.cartCount).toHaveText('3');
    },
  );

  test(
    'retirer une ligne la supprime et laisse les autres intactes',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-104', 'Suppression d’une ligne'), covers('REQ-CART-07')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([
        { sku: PRODUCTS.cheap.sku, quantity: 1 },
        { sku: PRODUCTS.strings.sku, quantity: 2 },
      ]);
      await cartPage.open();
      await expect(cartPage.lines).toHaveCount(2);

      await cartPage.lineBySku(PRODUCTS.cheap.sku).remove.click();

      await expect(cartPage.lines).toHaveCount(1);
      await expect(cartPage.lineBySku(PRODUCTS.strings.sku).root).toBeVisible();
      await expect(cartPage.subtotal).toShowPrice(PRODUCTS.strings.priceCents * 2);
    },
  );

  test(
    'vider le panier ligne à ligne ramène à l’état vide',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-105', 'Panier vidé intégralement')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await cartPage.open();

      await cartPage.line(0).remove.click();

      await expect(cartPage.emptyState).toBeVisible();
      await expect(cartPage.header.cartCount).toHaveText('0');
    },
  );
});

test.describe('Panier — totaux', () => {
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
    'au-dessus du seuil, la livraison passe à « offerte »',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-106', 'Franchissement du seuil de port'), covers('REQ-CART-04')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.inStock.sku, quantity: 1 }]);
      await cartPage.open();

      expect(PRODUCTS.inStock.priceCents).toBeGreaterThanOrEqual(RULES.freeShippingThresholdCents);
      await expect(cartPage.shipping).toHaveText('Offerte');
      await expect(cartPage.total).toShowPrice(PRODUCTS.inStock.priceCents);
    },
  );

  test(
    'la TVA affichée est bien contenue dans le total, pas ajoutée',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-107', 'Calcul de la TVA'), covers('REQ-CART-08')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      // French retail prices are VAT-inclusive: the VAT line is a breakdown of
      // the total, and a total that equals subtotal + VAT would be a real bug.
      const total = PRODUCTS.cheap.priceCents * 2 + RULES.flatShippingCents;
      await expect(cartPage.total).toShowPrice(total);
      await expect(cartPage.vat).toShowPrice(vatIncludedIn(total));
    },
  );
});

test.describe('Panier — codes promo', () => {
  test(
    'un code valide applique la remise et recalcule le total',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-110', 'Code promo valide'), covers('REQ-COUPON-01')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      const subtotal = PRODUCTS.cheap.priceCents * 2;
      await cartPage.applyCoupon(COUPONS.valid.code);

      await expect(cartPage.appliedCoupon).toContainText(COUPONS.valid.code);
      const discount = percentOf(subtotal, COUPONS.valid.percent);
      // The summary renders a discount as a negative amount ("- 8,26 €"), so the
      // expectation carries the sign rather than quietly taking an absolute value.
      await expect(cartPage.discount).toShowPrice(-discount);
      await expect(cartPage.total).toShowPrice(subtotal - discount + RULES.flatShippingCents);
    },
  );

  test(
    'retirer le code promo restaure le total initial',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-111', 'Retrait d’un code promo'), covers('REQ-COUPON-02')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      const subtotal = PRODUCTS.cheap.priceCents * 2;
      await cartPage.applyCoupon(COUPONS.valid.code);
      await cartPage.removeCoupon.click();

      await expect(cartPage.couponInput).toBeVisible();
      await expect(cartPage.total).toShowPrice(subtotal + RULES.flatShippingCents);
    },
  );

  test(
    'un code inexistant affiche une erreur explicite',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-112', 'Code promo inconnu'), covers('REQ-COUPON-03')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      await cartPage.applyCoupon(COUPONS.unknown.code);

      await expect(cartPage.couponError).toContainText('n’existe pas');
      await expect(cartPage.discount).toBeHidden();
    },
  );

  test(
    'un code expiré est refusé avec le bon motif',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-113', 'Code promo expiré'), covers('REQ-COUPON-03')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      await cartPage.applyCoupon(COUPONS.expired.code);
      await expect(cartPage.couponError).toContainText('expiré');
    },
  );

  test(
    'un code sous son minimum d’achat indique le montant requis',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-114', 'Code promo — minimum non atteint'), covers('REQ-COUPON-04')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await cartPage.open();

      await cartPage.applyCoupon(COUPONS.highMinimum.code);
      await expect(cartPage.couponError).toContainText('500,00');
    },
  );

  test(
    'un code réservé à une catégorie ne s’applique qu’aux articles concernés',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-115', 'Code promo par catégorie'), covers('REQ-COUPON-05')],
    },
    async ({ cartWith, cartPage }) => {
      await cartWith([
        { sku: PRODUCTS.strings.sku, quantity: 1 },
        { sku: PRODUCTS.cheap.sku, quantity: 1 },
      ]);
      await cartPage.open();

      await cartPage.applyCoupon(COUPONS.categoryScoped.code);

      // The discount is capped by the eligible subtotal — the pedal in the cart
      // must not contribute to it.
      await expect(cartPage.discount).toShowPrice(
        -Math.min(COUPONS.categoryScoped.amountCents, PRODUCTS.strings.priceCents),
      );
    },
  );
});
