import { expect as baseExpect } from '@playwright/test';
import type { Locator } from '@playwright/test';

import { formatCents, parsePriceToCents } from '@/utils/money';

/**
 * Domain-specific matchers.
 *
 * `await expect(locator).toShowPrice(279900)` states the business fact. The
 * alternative — reading the text, stripping four kinds of Unicode space,
 * parsing a French decimal, then comparing — states the plumbing, and buries
 * the intent under it. Matchers also retry like any built-in assertion, so they
 * remain safe against re-rendering.
 */
export const expect = baseExpect.extend({
  /** Asserts the element renders exactly this amount, whatever the formatting. */
  async toShowPrice(locator: Locator, expectedCents: number) {
    const assertionName = 'toShowPrice';
    let actualText = '';
    let pass = false;

    try {
      await baseExpect(locator).toBeVisible();
      actualText = (await locator.innerText()).trim();
      pass = parsePriceToCents(actualText) === expectedCents;
    } catch {
      pass = false;
    }

    return {
      name: assertionName,
      pass,
      expected: formatCents(expectedCents),
      actual: actualText,
      message: () =>
        pass
          ? `Le montant ne devait pas être ${formatCents(expectedCents)}, or il l’est.`
          : `Montant attendu : ${formatCents(expectedCents)} (${expectedCents} centimes)\n` +
            `Montant affiché : « ${actualText} »`,
    };
  },

  /**
   * Asserts a list of price elements is ordered. Sorting bugs hide in ties, so
   * the comparison is on parsed cents rather than on rendered strings.
   */
  async toBeSortedByPrice(locator: Locator, direction: 'asc' | 'desc') {
    const texts = await locator.allInnerTexts();
    const cents = texts.map((text) => parsePriceToCents(text));
    const sorted = [...cents].sort((a, b) => (direction === 'asc' ? a - b : b - a));
    const pass = cents.every((value, index) => value === sorted[index]);

    return {
      name: 'toBeSortedByPrice',
      pass,
      expected: sorted,
      actual: cents,
      message: () =>
        pass
          ? `Les prix ne devaient pas être triés en ordre ${direction}, or ils le sont.`
          : `Les prix ne sont pas triés en ordre ${direction}.\n` +
            `Ordre observé : ${cents.join(', ')}\n` +
            `Ordre attendu : ${sorted.join(', ')}`,
    };
  },
});
