import type { Page } from '@playwright/test';

import { expect, test } from '@/fixtures/test-fixtures';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Thème d'affichage : détection de l'appareil et bascule manuelle.
 *
 * Les assertions portent sur la couleur **calculée** du corps de page plutôt
 * que sur une classe ou un attribut. C'est ce qui distingue « le thème est
 * demandé » de « le thème est appliqué » : l'attribut peut être posé sans que
 * la cascade suive, et c'est exactement ce qui se produirait si un token
 * sémantique perdait sa branche sombre.
 */
const FOND = {
  clair: 'rgb(245, 247, 250)',
  sombre: 'rgb(11, 18, 32)',
} as const;

async function fondDePage(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe('Thème d’affichage', () => {
  test.describe('appareil en thème clair', () => {
    test.use({ colorScheme: 'light' });

    test(
      'le site s’affiche en clair sans choix explicite',
      {
        tag: [TAGS.smoke],
        annotation: [
          testCase('TC-426', 'Thème clair suivi depuis la préférence de l’appareil'),
          covers('REQ-THEME-01'),
        ],
      },
      async ({ homePage, page }) => {
        await homePage.open();

        expect(await fondDePage(page)).toBe(FOND.clair);
        // Rien n'a été choisi : la page ne doit porter aucun verrou de thème,
        // sinon elle cesserait de suivre l'appareil s'il changeait d'avis.
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      },
    );

    test(
      'le bouton bascule vers le thème sombre',
      {
        tag: [TAGS.smoke, TAGS.critical],
        annotation: [
          testCase('TC-427', 'Bascule manuelle vers le thème sombre'),
          covers('REQ-THEME-02'),
        ],
      },
      async ({ homePage, page }) => {
        await homePage.open();
        expect(await homePage.header.themeToggleLabel()).toBe('Thème sombre');

        await homePage.header.toggleTheme();

        expect(await fondDePage(page)).toBe(FOND.sombre);
        // Le libellé nomme la destination, pas l'état : une fois en sombre, le
        // bouton doit proposer le retour au clair.
        expect(await homePage.header.themeToggleLabel()).toBe('Thème clair');
      },
    );

    test(
      'la bascule survit à la navigation',
      {
        tag: [TAGS.regression],
        annotation: [
          testCase('TC-428', 'Persistance du thème choisi d’une page à l’autre'),
          covers('REQ-THEME-04'),
        ],
      },
      async ({ homePage, cartPage, page }) => {
        await homePage.open();
        await homePage.header.toggleTheme();

        await cartPage.open();

        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        expect(await fondDePage(page)).toBe(FOND.sombre);
      },
    );

    test(
      'le thème choisi est appliqué même sans le bundle de l’application',
      {
        tag: [TAGS.regression],
        annotation: [
          testCase('TC-431', 'Absence de scintillement — thème posé avant le framework'),
          covers('REQ-THEME-04'),
        ],
      },
      async ({ homePage, page, context }) => {
        await homePage.open();
        await homePage.header.toggleTheme();

        // Le défaut visé est un scintillement : la page apparaît dans le mauvais
        // thème, puis se corrige. Une assertion prise après le chargement ne le
        // verrait pas — le thème finit toujours par être bon. Couper les scripts
        // de l'application rend la question décidable : ce qui reste ne peut
        // avoir été fait que par l'amorçage en tête de document, c'est-à-dire
        // avant la première peinture. La feuille de style, elle, passe.
        await context.route(/\/_next\/static\/.*\.js$/, (route) => route.abort());
        await page.goto('/panier');

        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('html[data-hydrated="true"]')).toHaveCount(0);
        expect(await fondDePage(page)).toBe(FOND.sombre);
      },
    );

  });

  test.describe('appareil en thème sombre', () => {
    test.use({ colorScheme: 'dark' });

    test(
      'le site s’affiche en sombre sans choix explicite',
      {
        tag: [TAGS.smoke],
        annotation: [
          testCase('TC-429', 'Thème sombre suivi depuis la préférence de l’appareil'),
          covers('REQ-THEME-01'),
        ],
      },
      async ({ homePage, page }) => {
        await homePage.open();

        expect(await fondDePage(page)).toBe(FOND.sombre);
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        expect(await homePage.header.themeToggleLabel()).toBe('Thème clair');
      },
    );

    test(
      'le choix explicite l’emporte sur la préférence de l’appareil',
      {
        tag: [TAGS.regression, TAGS.critical],
        annotation: [
          testCase('TC-430', 'Le thème choisi prime sur celui de l’appareil'),
          covers('REQ-THEME-03'),
        ],
      },
      async ({ homePage, page }) => {
        await homePage.open();
        await homePage.header.toggleTheme();

        expect(await fondDePage(page)).toBe(FOND.clair);

        // Un rechargement complet : c'est le cas que la seule bascule en
        // mémoire ne couvre pas, puisque le thème est alors reconstruit depuis
        // le stockage par le script d'amorçage.
        await page.reload();
        await homePage.waitForHydration();

        expect(await fondDePage(page)).toBe(FOND.clair);
        expect(await homePage.header.themeToggleLabel()).toBe('Thème sombre');
      },
    );
  });
});
