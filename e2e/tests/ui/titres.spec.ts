import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Page titles.
 *
 * The title is what a tab, a bookmark and the browser history show, and what a
 * screen reader announces on navigation. Every route is asserted on its exact
 * served title: a page that silently falls back to the layout default reads as
 * the home page everywhere outside the viewport — the 404 did exactly that.
 */
const SHOP_TITLE = 'Fretline — Guitares, basses et amplification';

const titled = (page: string) => `${page} | Fretline`;

const PUBLIC_ROUTES = [
  { id: 'TC-506', name: 'Accueil', path: '/', title: SHOP_TITLE },
  {
    id: 'TC-507',
    name: 'Rayon',
    path: `/c/${CATEGORIES.electricGuitars.slug}`,
    title: titled(CATEGORIES.electricGuitars.label),
  },
  {
    id: 'TC-508',
    name: 'Fiche produit',
    path: `/p/${PRODUCTS.inStock.slug}`,
    title: titled(`${PRODUCTS.inStock.brand} ${PRODUCTS.inStock.name}`),
  },
  { id: 'TC-509', name: 'Recherche', path: '/recherche?q=strat', title: titled('Recherche') },
  { id: 'TC-510', name: 'Panier', path: '/panier', title: titled('Panier') },
  { id: 'TC-511', name: 'Commande', path: '/commande', title: titled('Commande') },
  { id: 'TC-512', name: 'Comparateur', path: '/comparateur', title: titled('Comparateur') },
  { id: 'TC-513', name: 'Connexion', path: '/compte/connexion', title: titled('Connexion') },
  { id: 'TC-514', name: 'Inscription', path: '/compte/inscription', title: titled('Créer un compte') },
  { id: 'TC-515', name: 'Liste des guides', path: '/guides', title: titled('Guides d’achat') },
  {
    id: 'TC-516',
    name: 'Guide',
    path: '/guides/choisir-sa-premiere-guitare-electrique',
    title: titled('Choisir sa première guitare électrique'),
  },
  { id: 'TC-517', name: 'Route inconnue', path: '/cette-page-n-existe-pas', title: titled('Page introuvable') },
  // An unknown slug keeps the route's own fallback, which says what is missing.
  { id: 'TC-518', name: 'Produit inconnu', path: '/p/ce-produit-n-existe-pas', title: titled('Produit introuvable') },
  { id: 'TC-523', name: 'Rayon inconnu', path: '/c/ce-rayon-n-existe-pas', title: titled('Catégorie introuvable') },
  { id: 'TC-524', name: 'Guide inconnu', path: '/guides/ce-guide-n-existe-pas', title: titled('Guide introuvable') },
] as const;

const ACCOUNT_ROUTES = [
  { id: 'TC-519', name: 'Mes commandes', path: '/compte/commandes', title: titled('Mes commandes') },
  { id: 'TC-520', name: 'Mes favoris', path: '/compte/favoris', title: titled('Mes favoris') },
  { id: 'TC-521', name: 'Mes alertes', path: '/compte/alertes', title: titled('Mes alertes') },
] as const;

test.describe('Titres de page', () => {
  for (const route of PUBLIC_ROUTES) {
    test(
      `la page « ${route.name} » porte son propre titre`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Titre — ${route.name}`), covers('REQ-NAV-03')],
      },
      async ({ page }) => {
        await page.goto(route.path);

        await expect(page).toHaveTitle(route.title);
      },
    );
  }

  for (const route of ACCOUNT_ROUTES) {
    test(
      `la page « ${route.name} » porte son propre titre`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Titre — ${route.name}`), covers('REQ-NAV-03')],
      },
      async ({ page, registeredUser, signInAs }) => {
        await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
        await page.goto(route.path);

        // Guards against asserting the login page's title after a redirect.
        expect(new URL(page.url()).pathname).toBe(route.path);
        await expect(page).toHaveTitle(route.title);
      },
    );
  }

  test(
    'la confirmation de commande porte son propre titre',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-522', 'Titre — Confirmation de commande'), covers('REQ-NAV-03')],
    },
    async ({ cartWith, checkoutPage, confirmationPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();
      await checkoutPage.completeCheckout({
        address: new AddressBuilder().build(),
        email: 'titre@fretline.test',
      });

      await expect(confirmationPage.root).toBeVisible();
      await expect(page).toHaveTitle(titled('Commande confirmée'));
    },
  );
});
