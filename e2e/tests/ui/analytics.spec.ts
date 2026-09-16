import { expect, test } from '@/fixtures/test-fixtures';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Lock on the tracker guard (app/src/app/layout.tsx).
 *
 * The suite already blocks requests to Matomo at the context level
 * (fixtures/test-fixtures.ts), so nothing would visibly break if the guard
 * disappeared: the tests would keep passing, and the protection would shrink
 * to the safety net, silently. This spec looks at the served HTML, not the
 * network — it is the only place where the guard's disappearance shows.
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
