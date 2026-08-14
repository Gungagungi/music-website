import { expect, test } from '@/fixtures/test-fixtures';
import { COUPONS, PRODUCTS } from '@/data/seed';
import { atLeast, formatViolations, scanForViolations } from '@/utils/a11y';
import { percentOf } from '@/utils/money';
import { TAGS, covers, knownBug, testCase } from '@/utils/tags';

/**
 * Demonstration suite for the three deliberately seeded defects.
 *
 * Every test here asserts the **correct** behaviour, so the suite is green on a
 * normal run and red when the application is started with `SEED_BUGS=1`. That
 * is the whole point: it shows the suite catching real regressions rather than
 * asserting that a bug is still present.
 *
 *   npm run test:bugs -w e2e        # runs these against the bugged build
 *
 * Each defect is also caught by the ordinary suites — the rounding bug by the
 * coupon tests, the sorting bug by the pagination-integrity test, the labelling
 * bug by the accessibility scan. This file exists to make the link between a
 * bug report and its automated proof explicit.
 */
test.describe('Défauts connus — preuve de détection', () => {
  test(
    'la remise en pourcentage est calculée au centime près',
    {
      tag: [TAGS.knownBug, TAGS.critical],
      annotation: [
        testCase('TC-350', 'Arrondi de la remise'),
        knownBug('BUG-001', 'Remise en pourcentage tronquée à l’euro inférieur'),
        covers('REQ-COUPON-01'),
      ],
    },
    async ({ cartWith, cartPage }) => {
      // 2 × 41,30 € = 82,60 €, dont 10 % font 8,26 € — un sous-total qui n'est
      // pas un compte rond est précisément le cas que l'arrondi fautif casse.
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 2 }]);
      await cartPage.open();

      const subtotal = PRODUCTS.cheap.priceCents * 2;
      await cartPage.applyCoupon(COUPONS.valid.code);

      await expect(cartPage.discount).toShowPrice(-percentOf(subtotal, COUPONS.valid.percent));
    },
  );

  test(
    'le tri par prix s’applique à l’ensemble du rayon, pas page par page',
    {
      tag: [TAGS.knownBug, TAGS.critical],
      annotation: [
        testCase('TC-351', 'Portée du tri en pagination'),
        knownBug('BUG-002', 'Tri appliqué après découpage : chaque page triée isolément'),
        covers('REQ-PAGE-02'),
      ],
    },
    async ({ catalogPage }) => {
      await catalogPage.openCategory('guitares-electriques', { sort: 'prix-asc' });
      const firstPage = await catalogPage.displayedPricesCents();

      await catalogPage.goToPage(2);
      const secondPage = await catalogPage.displayedPricesCents();

      // Each page taken alone can look perfectly sorted while the sequence as a
      // whole is not — page 2 opening below the end of page 1 is the tell.
      const all = [...firstPage, ...secondPage];
      expect(all, 'La séquence complète n’est pas ordonnée par prix croissant.').toEqual(
        [...all].sort((a, b) => a - b),
      );
    },
  );

  test(
    'tous les champs de formulaire portent un libellé programmatique',
    {
      tag: [TAGS.knownBug],
      annotation: [
        testCase('TC-352', 'Libellés de formulaire'),
        knownBug('BUG-003', 'Champs sans label associé (newsletter, complément d’adresse)'),
        covers('REQ-A11Y-03'),
      ],
    },
    async ({ cartWith, checkoutPage, page }) => {
      await cartWith([{ sku: PRODUCTS.cheap.sku, quantity: 1 }]);
      await checkoutPage.open();

      const violations = await scanForViolations(page, { disableRules: ['color-contrast'] });
      const labelling = violations.filter((violation) =>
        ['label', 'form-field-multiple-labels', 'select-name'].includes(violation.id),
      );

      expect(labelling, formatViolations(labelling)).toEqual([]);
      expect(atLeast(violations, 'serious'), formatViolations(violations)).toEqual([]);
    },
  );
});
