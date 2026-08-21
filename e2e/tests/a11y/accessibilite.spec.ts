import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { atLeast, formatViolations, scanForViolations } from '@/utils/a11y';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * WCAG 2.1 AA scans on the pages a customer cannot avoid.
 *
 * The threshold is `serious`: minor and moderate findings are reported in the
 * run output but do not fail the build. A gate that fires on every
 * best-practice suggestion gets muted within a fortnight, and then the serious
 * findings go unnoticed too.
 */
const PAGES = [
  { name: 'accueil', path: '/', tc: 'TC-310', tcDark: 'TC-440' },
  { name: 'catalogue', path: `/c/${CATEGORIES.electricGuitars.slug}`, tc: 'TC-311', tcDark: 'TC-441' },
  { name: 'fiche produit', path: `/p/${PRODUCTS.inStock.slug}`, tc: 'TC-312', tcDark: 'TC-442' },
  { name: 'recherche', path: '/recherche?q=guitare', tc: 'TC-313', tcDark: 'TC-443' },
  { name: 'connexion', path: '/compte/connexion', tc: 'TC-314', tcDark: 'TC-444' },
  { name: 'inscription', path: '/compte/inscription', tc: 'TC-315', tcDark: 'TC-445' },
  { name: 'comparateur', path: `/comparateur?refs=${PRODUCTS.inStock.slug},${PRODUCTS.cheap.slug}`, tc: 'TC-316', tcDark: 'TC-446' },
] as const;

test.describe('Accessibilité — pages publiques', () => {
  for (const target of PAGES) {
    test(
      `la page ${target.name} ne présente aucune violation sérieuse`,
      {
        tag: [TAGS.smoke],
        annotation: [testCase(target.tc as `TC-${string}`, `Scan a11y — ${target.name}`), covers('REQ-A11Y-01')],
      },
      async ({ page }) => {
        await page.goto(target.path);

        const violations = await scanForViolations(page);
        const blocking = atLeast(violations, 'serious');

        expect(blocking, `Violations WCAG 2.1 AA :\n${formatViolations(blocking)}`).toEqual([]);
      },
    );
  }
});

test.describe('Accessibilité — parcours transactionnel', () => {
  test(
    'le panier rempli est exempt de violations sérieuses',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-317', 'Scan a11y — panier'), covers('REQ-A11Y-01')],
    },
    async ({ cartWith, cartPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      const blocking = atLeast(await scanForViolations(page), 'serious');
      expect(blocking, formatViolations(blocking)).toEqual([]);
    },
  );

  test(
    'chaque étape du tunnel de commande est exempte de violations sérieuses',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-318', 'Scan a11y — tunnel de commande'), covers('REQ-A11Y-02')],
    },
    async ({ cartWith, checkoutPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      let blocking = atLeast(await scanForViolations(page), 'serious');
      expect(blocking, `Étape livraison :\n${formatViolations(blocking)}`).toEqual([]);

      await checkoutPage.fillShipping(new AddressBuilder().build(), 'a11y@fretline.test');
      await checkoutPage.shippingContinue.click();
      await expect(checkoutPage.paymentForm).toBeVisible();

      blocking = atLeast(await scanForViolations(page), 'serious');
      expect(blocking, `Étape paiement :\n${formatViolations(blocking)}`).toEqual([]);

      await checkoutPage.paymentContinue.click();
      await expect(checkoutPage.reviewStep).toBeVisible();

      blocking = atLeast(await scanForViolations(page), 'serious');
      expect(blocking, `Étape récapitulatif :\n${formatViolations(blocking)}`).toEqual([]);
    },
  );

  test(
    'les messages d’erreur de formulaire restent accessibles',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-319', 'Scan a11y — erreurs de formulaire'), covers('REQ-A11Y-03')],
    },
    async ({ cartWith, checkoutPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();
      await checkoutPage.shippingContinue.click();
      await expect(checkoutPage.fieldError('postalCode')).toBeVisible();

      // An error that is only visually red tells a screen-reader user nothing.
      await expect(checkoutPage.postalCodeField).toHaveAttribute('aria-invalid', 'true');
      const describedBy = await checkoutPage.postalCodeField.getAttribute('aria-describedby');
      expect(describedBy).toContain('postalCode-error');

      const blocking = atLeast(await scanForViolations(page), 'serious');
      expect(blocking, formatViolations(blocking)).toEqual([]);
    },
  );
});

test.describe('Accessibilité — navigation au clavier', () => {
  test(
    'le lien d’évitement est la première cible du clavier',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-320', 'Lien d’évitement'), covers('REQ-A11Y-04')],
    },
    async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      await expect(focused).toHaveText('Aller au contenu principal');

      await focused.press('Enter');
      expect(new URL(page.url()).hash).toBe('#contenu');
    },
  );

  test(
    'le tunnel de commande se remplit entièrement au clavier',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-321', 'Parcours clavier'), covers('REQ-A11Y-05')],
    },
    async ({ cartWith, checkoutPage }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      const address = new AddressBuilder().build();

      // Focus the first field, then move through the form with Tab alone: any
      // field skipped by the tab order is unreachable for a keyboard user.
      await checkoutPage.emailField.focus();
      await checkoutPage.emailField.type('clavier@fretline.test');

      for (const value of [
        address.firstName,
        address.lastName,
        address.line1,
        '', // complément d'adresse, facultatif
        address.postalCode,
        address.city,
      ]) {
        await checkoutPage.emailField.page().keyboard.press('Tab');
        if (value) await checkoutPage.emailField.page().keyboard.type(value);
      }

      await expect(checkoutPage.cityField).toHaveValue(address.city);
      await expect(checkoutPage.postalCodeField).toHaveValue(address.postalCode);
    },
  );

  test(
    'les images produits portent une alternative textuelle pertinente',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-322', 'Alternatives textuelles'), covers('REQ-A11Y-06')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      // The main image describes the product; the decorative thumbnails in the
      // grid carry an empty alt on purpose, and axe checks the rest.
      await expect(productPage.image).toHaveAttribute(
        'alt',
        `${PRODUCTS.inStock.brand} ${PRODUCTS.inStock.name}`,
      );
    },
  );
});

/**
 * Le thème sombre repasse le scan de contraste, pas seulement le scan de
 * structure.
 *
 * C'est la seule partie de la fonctionnalité qu'une relecture ne suffit pas à
 * garder : un texte gris sur fond blanc lisible devient illisible sur fond
 * sombre sans que rien ne le signale, et le rapport de contraste est
 * exactement ce qu'axe sait calculer. Le scan tourne avec l'appareil réglé en
 * sombre plutôt qu'en cliquant le bouton, parce que c'est ainsi que la plupart
 * des visiteurs concernés arriveront sur le site.
 */
test.describe('Accessibilité — thème sombre', () => {
  test.use({ colorScheme: 'dark' });

  for (const target of PAGES) {
    test(
      `la page ${target.name} reste exempte de violations sérieuses en thème sombre`,
      {
        tag: [TAGS.regression],
        annotation: [
          testCase(target.tcDark as `TC-${string}`, `Scan a11y sombre — ${target.name}`),
          covers('REQ-A11Y-07'),
        ],
      },
      async ({ page }) => {
        await page.goto(target.path);
        await expect(page.locator('html[data-hydrated="true"]')).toBeAttached();

        const blocking = atLeast(await scanForViolations(page), 'serious');

        expect(blocking, `Violations WCAG 2.1 AA (thème sombre) :\n${formatViolations(blocking)}`).toEqual([]);
      },
    );
  }
});
