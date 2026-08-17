import { expect as baseExpect } from '@playwright/test';
import type { Locator } from '@playwright/test';

import { TIMEOUTS } from '@/config/env';
import { formatCents, parsePriceToCents } from '@/utils/money';

interface MatcherOptions {
  timeout?: number;
}

/**
 * Domain-specific matchers.
 *
 * `await expect(locator).toShowPrice(279900)` states the business fact. The
 * alternative — reading the text, stripping four kinds of Unicode space,
 * parsing a French decimal, then comparing — states the plumbing, and buries
 * the intent under it.
 *
 * Both matchers poll. This is not decoration: a custom matcher built with
 * `expect.extend` does *not* inherit the auto-retry of built-in assertions, so
 * a single `innerText()` read races every re-render. The cart total assertion
 * caught exactly that — it read the pre-update amount on Chromium and WebKit,
 * passed on retry, and showed up as flaky rather than as the framework defect
 * it was. Polling is delegated to `toPass`, which is the retrying primitive.
 */
export const expect = baseExpect.extend({
  /** Asserts the element renders exactly this amount, whatever the formatting. */
  async toShowPrice(locator: Locator, expectedCents: number, options?: MatcherOptions) {
    const isNot = this.isNot;
    let actualText = '';
    let pass = false;

    try {
      await baseExpect(async () => {
        actualText = (await locator.innerText()).trim();
        pass = parsePriceToCents(actualText) === expectedCents;
        // Poll towards the outcome the caller is asserting — including under
        // `.not`, where waiting for the amount to *stop* matching is the point.
        if (pass === isNot) throw new Error(`Montant courant : « ${actualText} »`);
      }).toPass({ timeout: options?.timeout ?? TIMEOUTS.expect });
    } catch {
      // Polling timed out; `actualText` and `pass` hold the last observation,
      // which is what the failure message needs to be actionable.
    }

    return {
      name: 'toShowPrice',
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
  async toBeSortedByPrice(locator: Locator, direction: 'asc' | 'desc', options?: MatcherOptions) {
    const isNot = this.isNot;
    let cents: number[] = [];
    let sorted: number[] = [];
    let pass = false;

    try {
      await baseExpect(async () => {
        cents = (await locator.allInnerTexts()).map((text) => parsePriceToCents(text));
        sorted = [...cents].sort((a, b) => (direction === 'asc' ? a - b : b - a));
        pass = cents.length > 0 && cents.every((value, index) => value === sorted[index]);
        if (pass === isNot) throw new Error(`Ordre courant : ${cents.join(', ')}`);
      }).toPass({ timeout: options?.timeout ?? TIMEOUTS.expect });
    } catch {
      // Same rationale as above: keep the last observation for the message.
    }

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
