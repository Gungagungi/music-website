import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Search engine indexing.
 *
 * Private pages carry `noindex`: they show one visitor's state, so an indexed
 * cart or account page only ever sends a stranger to an empty one or to a login
 * redirect. The public pages are asserted too — a `noindex` that leaks into the
 * root layout would empty the shop from search results without a single
 * visible change, and nothing else in the suite would notice.
 */
const NOINDEX = 'meta[name="robots"][content*="noindex"]';

const PRIVATE_ROUTES = [
  { id: 'TC-532', name: 'Panier', path: '/panier' },
  { id: 'TC-533', name: 'Commande', path: '/commande' },
  { id: 'TC-534', name: 'Connexion', path: '/compte/connexion' },
  { id: 'TC-535', name: 'Inscription', path: '/compte/inscription' },
] as const;

const ACCOUNT_ROUTES = [
  { id: 'TC-536', name: 'Mes commandes', path: '/compte/commandes' },
  { id: 'TC-537', name: 'Mes favoris', path: '/compte/favoris' },
  { id: 'TC-538', name: 'Mes alertes', path: '/compte/alertes' },
] as const;

const PUBLIC_ROUTES = [
  { id: 'TC-540', name: 'Accueil', path: '/' },
  { id: 'TC-541', name: 'Rayon', path: `/c/${CATEGORIES.electricGuitars.slug}` },
  { id: 'TC-542', name: 'Fiche produit', path: `/p/${PRODUCTS.inStock.slug}` },
  { id: 'TC-543', name: 'Guide', path: '/guides/choisir-sa-premiere-guitare-electrique' },
] as const;

test.describe('Indexation par les moteurs de recherche', () => {
  for (const route of PRIVATE_ROUTES) {
    test(
      `la page « ${route.name} » est exclue de l’indexation`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Indexation — ${route.name}`), covers('REQ-NAV-06')],
      },
      async ({ page }) => {
        await page.goto(route.path);

        await expect(page.locator(NOINDEX)).toHaveCount(1);
      },
    );
  }

  for (const route of ACCOUNT_ROUTES) {
    test(
      `la page « ${route.name} » est exclue de l’indexation`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Indexation — ${route.name}`), covers('REQ-NAV-06')],
      },
      async ({ page, registeredUser, signInAs }) => {
        await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
        await page.goto(route.path);

        // Guards against asserting the login page's noindex after a redirect.
        expect(new URL(page.url()).pathname).toBe(route.path);
        await expect(page.locator(NOINDEX)).toHaveCount(1);
      },
    );
  }

  test(
    'la confirmation de commande est exclue de l’indexation',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-539', 'Indexation — Confirmation de commande'), covers('REQ-NAV-06')],
    },
    async ({ cartWith, checkoutPage, confirmationPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();
      await checkoutPage.completeCheckout({
        address: new AddressBuilder().build(),
        email: 'indexation@fretline.test',
      });

      await expect(confirmationPage.root).toBeVisible();
      await expect(page.locator(NOINDEX)).toHaveCount(1);
    },
  );

  for (const route of PUBLIC_ROUTES) {
    test(
      `la page « ${route.name} » reste indexable`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Indexation — ${route.name}`), covers('REQ-NAV-06')],
      },
      async ({ page }) => {
        await page.goto(route.path);

        await expect(page.locator(NOINDEX)).toHaveCount(0);
      },
    );
  }
});
