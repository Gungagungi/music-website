import { expect, test } from '@/fixtures/test-fixtures';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Verrou sur la garde du tracker (app/src/app/layout.tsx).
 *
 * La suite bloque déjà les requêtes vers Matomo au niveau du contexte
 * (fixtures/test-fixtures.ts), donc rien ne casserait visiblement si la garde
 * disparaissait : les tests continueraient de passer, et la protection se
 * réduirait au filet, silencieusement. Cette spec regarde le HTML servi, pas le
 * réseau — c'est le seul endroit où la disparition de la garde se voit.
 */
test.describe('Mesure d’audience', () => {
  test(
    'aucune balise Matomo n’est servie en mode test',
    {
      tag: [TAGS.smoke, TAGS.security],
      annotation: [
        testCase('TC-425', 'Absence du tracker sous E2E_TEST_MODE'),
        covers('REQ-SEC-16'),
      ],
    },
    async ({ homePage, page }) => {
      await homePage.open();

      await expect(page.locator('script#matomo-init')).toHaveCount(0);
      await expect(page.locator('script[src*="matomo"]')).toHaveCount(0);
      expect(await page.evaluate(() => '_paq' in window)).toBe(false);
    },
  );
});
