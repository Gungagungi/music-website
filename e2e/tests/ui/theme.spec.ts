import type { Page } from '@playwright/test';

import { expect, test } from '@/fixtures/test-fixtures';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Display theme: device detection, manual cycle, return to following the device.
 *
 * The assertions target the page body's **computed** colour rather than a class
 * or an attribute. That is what separates "the theme is requested" from "the
 * theme is applied": the attribute can be set without the cascade following,
 * and that is exactly what would happen if a semantic token lost its dark
 * branch.
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
        expect(await homePage.header.themeMode()).toBe('Système');
        // Nothing has been chosen: the page must carry no theme lock, otherwise
        // it would stop following the device if the device changed its mind.
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      },
    );

    test(
      'le bouton parcourt les trois états et revient au suivi de l’appareil',
      {
        tag: [TAGS.smoke, TAGS.critical],
        annotation: [
          testCase('TC-427', 'Cycle Système → Clair → Sombre → Système'),
          covers('REQ-THEME-02'),
        ],
      },
      async ({ homePage, page }) => {
        await homePage.open();
        const html = page.locator('html');

        expect(await homePage.header.themeMode()).toBe('Système');

        await homePage.header.cycleTheme();
        expect(await homePage.header.themeMode()).toBe('Clair');
        await expect(html).toHaveAttribute('data-theme', 'light');
        expect(await fondDePage(page)).toBe(FOND.clair);

        await homePage.header.cycleTheme();
        expect(await homePage.header.themeMode()).toBe('Sombre');
        await expect(html).toHaveAttribute('data-theme', 'dark');
        expect(await fondDePage(page)).toBe(FOND.sombre);

        // The case the first version was missing: without this third step, a
        // visitor who had touched the button once could no longer return to
        // following their device other than by clearing their storage.
        await homePage.header.cycleTheme();
        expect(await homePage.header.themeMode()).toBe('Système');
        await expect(html).not.toHaveAttribute('data-theme');
        expect(await fondDePage(page)).toBe(FOND.clair);
      },
    );

    test(
      'le choix explicite survit à la navigation',
      {
        tag: [TAGS.regression],
        annotation: [
          testCase('TC-428', 'Persistance du thème choisi d’une page à l’autre'),
          covers('REQ-THEME-04'),
        ],
      },
      async ({ homePage, cartPage, page }) => {
        await homePage.open();
        await homePage.header.cycleTheme(); // light
        await homePage.header.cycleTheme(); // dark

        await cartPage.open();

        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        expect(await fondDePage(page)).toBe(FOND.sombre);
      },
    );

    test(
      'le retour au suivi de l’appareil survit à la navigation',
      {
        tag: [TAGS.regression],
        annotation: [
          testCase('TC-432', 'Le retour à « Système » efface le choix mémorisé'),
          covers('REQ-THEME-05'),
        ],
      },
      async ({ homePage, cartPage, page }) => {
        await homePage.open();
        for (let i = 0; i < 3; i += 1) await homePage.header.cycleTheme();

        await cartPage.open();

        // A full cycle must bring back the initial state, storage included: a
        // "system" stored as a value would be indistinguishable from an explicit
        // choice on the next load.
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        expect(await page.evaluate(() => localStorage.getItem('fretline-theme'))).toBeNull();
        expect(await homePage.header.themeMode()).toBe('Système');
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
        await homePage.header.cycleTheme(); // light
        await homePage.header.cycleTheme(); // dark

        // The defect targeted is a flash: the page appears in the wrong theme,
        // then corrects itself. An assertion taken after loading would not see
        // it — the theme always ends up right. Cutting off the application's
        // scripts makes the question decidable: whatever remains can only have
        // been done by the bootstrap at the head of the document, that is,
        // before first paint. The stylesheet, for its part, goes through.
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
        expect(await homePage.header.themeMode()).toBe('Système');
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
        await homePage.header.cycleTheme(); // light, against the device

        expect(await fondDePage(page)).toBe(FOND.clair);

        // A full reload: the case an in-memory toggle alone does not cover,
        // since the theme is then rebuilt from storage by the bootstrap script.
        await page.reload();
        await homePage.waitForHydration();

        expect(await fondDePage(page)).toBe(FOND.clair);
        expect(await homePage.header.themeMode()).toBe('Clair');
      },
    );
  });
});
