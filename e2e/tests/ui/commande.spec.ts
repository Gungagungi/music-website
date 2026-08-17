import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { COUPONS, PRODUCTS, RULES } from '@/data/seed';
import { percentOf } from '@/utils/money';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Tunnel de commande', () => {
  test(
    'un invité peut commander de bout en bout',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-120', 'Commande invité'), covers('REQ-ORDER-01')],
    },
    async ({ cartWith, checkoutPage, confirmationPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await checkoutPage.open();

      await expect(checkoutPage.guestNotice).toBeVisible();
      const address = new AddressBuilder().build();
      await checkoutPage.completeCheckout({ address, email: 'invite@fretline.test' });

      await expect(confirmationPage.root).toBeVisible();
      await expect(confirmationPage.reference).toHaveText(/^FRT-\d{6}$/);
      await expect(confirmationPage.email).toHaveText('invite@fretline.test');
      await expect(confirmationPage.total).toShowPrice(
        PRODUCTS.cheap.priceCents * 2 + RULES.flatShippingCents,
      );
    },
  );

  test(
    'un client connecté retrouve sa commande dans son historique',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-121', 'Commande authentifiée'), covers('REQ-ORDER-02')],
    },
    async ({ registeredUser, signInAs, cartWith, checkoutPage, confirmationPage, ordersPage }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);

      await checkoutPage.open();
      // No e-mail field: the account already supplies it.
      await expect(checkoutPage.guestNotice).toBeHidden();
      await checkoutPage.completeCheckout({ address: new AddressBuilder().build() });

      const reference = await confirmationPage.reference.innerText();

      await ordersPage.open();
      await expect(ordersPage.orderByReference(reference)).toBeVisible();
      await expect(ordersPage.orderByReference(reference)).toContainText('Confirmée');
    },
  );

  test(
    'les trois étapes s’enchaînent et la marche arrière conserve la saisie',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-122', 'Navigation entre étapes'), covers('REQ-ORDER-03')],
    },
    async ({ cartWith, checkoutPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      const address = new AddressBuilder().withCity('Nantes').build();
      await checkoutPage.fillShipping(address, 'etapes@fretline.test');
      await checkoutPage.shippingContinue.click();

      await expect(checkoutPage.paymentForm).toBeVisible();
      await expect(checkoutPage.step('paiement')).toHaveAttribute('aria-current', 'step');

      await checkoutPage.paymentBack.click();
      await expect(checkoutPage.cityField).toHaveValue('Nantes');
    },
  );

  test(
    'un formulaire de livraison incomplet bloque le passage à l’étape suivante',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-123', 'Validation de l’adresse'), covers('REQ-ORDER-04')],
    },
    async ({ cartWith, checkoutPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      await checkoutPage.shippingContinue.click();

      await expect(checkoutPage.fieldError('firstName')).toBeVisible();
      await expect(checkoutPage.fieldError('postalCode')).toBeVisible();
      await expect(checkoutPage.paymentForm).toBeHidden();
    },
  );

  test(
    'un code postal invalide est refusé avec le format attendu',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-124', 'Format du code postal'), covers('REQ-ORDER-04')],
    },
    async ({ cartWith, checkoutPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      const address = new AddressBuilder().withPostalCode('7500').build();
      await checkoutPage.fillShipping(address, 'cp@fretline.test');
      await checkoutPage.shippingContinue.click();

      await expect(checkoutPage.fieldError('postalCode')).toContainText('5 chiffres');
    },
  );

  test(
    'la commande ne part pas sans acceptation des conditions générales',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-125', 'CGV obligatoires'), covers('REQ-ORDER-05')],
    },
    async ({ cartWith, checkoutPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      await checkoutPage.fillShipping(new AddressBuilder().build(), 'cgv@fretline.test');
      await checkoutPage.shippingContinue.click();
      await checkoutPage.paymentContinue.click();
      await checkoutPage.placeOrder.click();

      await expect(checkoutPage.termsError).toBeVisible();
      expect(page.url()).not.toContain('confirmation');
    },
  );

  test(
    'la remise appliquée au panier est reportée sur la commande',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-126', 'Remise reportée à la commande'), covers('REQ-ORDER-06')],
    },
    async ({ cartWith, cartPage, checkoutPage, confirmationPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();
      await cartPage.applyCoupon(COUPONS.valid.code);
      await expect(cartPage.appliedCoupon).toBeVisible();

      await cartPage.proceedToCheckout();
      await checkoutPage.completeCheckout({
        address: new AddressBuilder().build(),
        email: 'remise@fretline.test',
      });

      const subtotal = PRODUCTS.cheap.priceCents * 2;
      const discount = percentOf(subtotal, COUPONS.valid.percent);
      await expect(confirmationPage.discount).toShowPrice(-discount);
      await expect(confirmationPage.total).toShowPrice(
        subtotal - discount + RULES.flatShippingCents,
      );
    },
  );

  test(
    'le panier est vidé après validation de la commande',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-127', 'Panier vidé après commande'), covers('REQ-ORDER-07')],
    },
    async ({ cartWith, checkoutPage, cartPage, confirmationPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();
      await checkoutPage.completeCheckout({
        address: new AddressBuilder().build(),
        email: 'vidage@fretline.test',
      });
      await expect(confirmationPage.root).toBeVisible();

      await cartPage.open();
      await expect(cartPage.emptyState).toBeVisible();
      await expect(cartPage.header.cartCount).toHaveText('0');
    },
  );

  test(
    'la confirmation d’une commande n’est pas accessible sans jeton',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-128', 'Confirmation protégée'), covers('REQ-SEC-03')],
    },
    async ({ cartWith, checkoutPage, confirmationPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();
      await checkoutPage.completeCheckout({
        address: new AddressBuilder().build(),
        email: 'jeton@fretline.test',
      });

      const reference = confirmationPage.referenceFromUrl();

      // Same URL, token stripped: a guest order must not be readable by anyone
      // who can guess a sequential reference.
      const response = await page.goto(`/commande/confirmation/${reference}`);
      expect(response?.status()).toBe(404);
    },
  );

  test(
    'accéder au tunnel avec un panier vide propose un retour à la boutique',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-129', 'Commande sans panier'), covers('REQ-ORDER-08')],
    },
    async ({ checkoutPage }) => {
      await checkoutPage.open();

      await expect(checkoutPage.emptyState).toBeVisible();
      await expect(checkoutPage.shippingForm).toBeHidden();
    },
  );
});
