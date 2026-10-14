import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';

export class ComparePage extends BasePage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly columns: Locator;
  readonly emptyState: Locator;
  readonly bar: Locator;
  readonly barItems: Locator;
  readonly openFromBar: Locator;
  readonly clear: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('compare-title');
    this.table = page.getByTestId('compare-table');
    this.columns = page.getByTestId('compare-column');
    this.emptyState = page.getByTestId('compare-empty');
    // The bar lives in the root layout, so it is reachable from every page —
    // which is the whole point of it.
    this.bar = page.getByTestId('compare-bar');
    this.barItems = page.getByTestId('compare-bar-item');
    this.openFromBar = page.getByTestId('compare-open');
    this.clear = page.getByTestId('compare-clear');
  }

  protected path(): string {
    return '/comparateur';
  }

  compare(slugs: string[]) {
    return this.open({ refs: slugs.join(',') });
  }

  async comparedSlugs(): Promise<string[]> {
    return this.columns.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-slug') ?? ''),
    );
  }

  /** How many products the bar reports, or zero when it is absent. */
  async selectionCount(): Promise<number> {
    if ((await this.bar.count()) === 0) return 0;
    return Number.parseInt((await this.bar.getAttribute('data-count')) ?? '0', 10);
  }

  /** A comparison row, addressed by its row header. */
  row(label: string): Locator {
    return this.table.locator('tbody tr').filter({ has: this.page.getByRole('rowheader', { name: label }) });
  }
}
