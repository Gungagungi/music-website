import { expect } from '@playwright/test';
import type { Locator } from '@playwright/test';

/**
 * Fills a React-controlled input and makes sure the value survives hydration.
 *
 * A server-rendered page accepts keystrokes before React has hydrated, and the
 * first re-render then resets a controlled input to its state value — which is
 * still empty. Playwright is fast enough to land in that window routinely:
 * WebKit dropped a cart quantity, then a coupon code, and both were reported as
 * flakiness rather than as the race they were.
 *
 * `fill()` followed by `toHaveValue()` does not fix it: the assertion retries
 * the *read*, never the write, so once the value has been wiped it stays wiped.
 * Re-filling until it sticks is what converges — the write-side equivalent of
 * an auto-retrying assertion.
 *
 * Worth stating plainly: this makes the *test* reliable, it does not make the
 * application immune. A real user typing that early loses their input too. The
 * fix belongs in the app — disable the control until interactive, or make it
 * uncontrolled — and is tracked as such rather than hidden behind this helper.
 */
export async function fillOnceHydrated(input: Locator, value: string): Promise<void> {
  await expect(async () => {
    await input.fill(value);
    await expect(input).toHaveValue(value, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
}
