import { expect, test } from '@/fixtures/test-fixtures';
import { CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Meta descriptions.
 *
 * The description is the snippet a search engine shows under the title. The
 * layout provides a default, so the tag is never missing — which is exactly why
 * a missing one goes unnoticed: a page that forgets its own description serves
 * the home page's, and every department ends up with the same snippet. Each
 * route is asserted against that default rather than on mere presence.
 */
const SHOP_DESCRIPTION =
  'Fretline, la boutique de démonstration dédiée aux guitares, basses, amplis et accessoires. Projet fictif de portfolio QA.';

const OWN_DESCRIPTION_ROUTES = [
  { id: 'TC-527', name: 'Fiche produit', path: `/p/${PRODUCTS.inStock.slug}` },
  { id: 'TC-528', name: 'Liste des guides', path: '/guides' },
  { id: 'TC-529', name: 'Guide', path: '/guides/choisir-sa-premiere-guitare-electrique' },
] as const;

test.describe('Descriptions de page', () => {
  test(
    'l’accueil porte la description de la boutique',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-525', 'Description — Accueil'), covers('REQ-NAV-04')],
    },
    async ({ page }) => {
      await page.goto('/');

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute('content', SHOP_DESCRIPTION);
    },
  );

  test(
    'un rayon est décrit par son accroche',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-526', 'Description — Rayon'), covers('REQ-NAV-04')],
    },
    async ({ page }) => {
      await page.goto(`/c/${CATEGORIES.electricGuitars.slug}`);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute('content', CATEGORIES.electricGuitars.tagline);
    },
  );

  for (const route of OWN_DESCRIPTION_ROUTES) {
    test(
      `la page « ${route.name} » porte sa propre description`,
      {
        tag: [TAGS.regression],
        annotation: [testCase(route.id, `Description — ${route.name}`), covers('REQ-NAV-04')],
      },
      async ({ page }) => {
        await page.goto(route.path);

        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveCount(1);
        await expect(description).toHaveAttribute('content', /\S/);
        await expect(description).not.toHaveAttribute('content', SHOP_DESCRIPTION);
      },
    );
  }
});
