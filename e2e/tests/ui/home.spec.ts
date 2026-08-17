import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Accueil', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test(
    'affiche le hero, les rayons et les trois sélections de produits',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-010', 'Structure de la page d’accueil'), covers('REQ-HOME-01')],
    },
    async ({ homePage }) => {
      await expect(homePage.hero).toBeVisible();
      await expect(homePage.title).toHaveText('Tout pour brancher, jouer et sonner juste.');

      await expect(homePage.categoryTiles.getByRole('listitem')).toHaveCount(9);

      for (const section of ['best-sellers', 'new-arrivals', 'hot-deals'] as const) {
        await expect(homePage.cardsIn(section).first()).toBeVisible();
      }
    },
  );

  test(
    'le panier démarre vide pour un visiteur non identifié',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-011', 'Compteur panier à l’état initial'), covers('REQ-CART-01')],
    },
    async ({ homePage }) => {
      await expect(homePage.header.cartCount).toHaveText('0');
      await expect(homePage.header.loginLink).toBeVisible();
    },
  );

  test(
    'un rayon de la page d’accueil mène au catalogue correspondant',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-012', 'Navigation vers une catégorie'), covers('REQ-NAV-01')],
    },
    async ({ homePage, catalogPage, page }) => {
      await homePage.categoryTile(CATEGORIES.electricGuitars.slug).click();
      await page.waitForURL(`**/c/${CATEGORIES.electricGuitars.slug}`);

      await expect(catalogPage.heading).toHaveText(CATEGORIES.electricGuitars.label);
      await expect(catalogPage.cards.first()).toBeVisible();
    },
  );
});
