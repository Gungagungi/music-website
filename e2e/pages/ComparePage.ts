import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';

export class ComparePage extends BasePage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly columns: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('compare-title');
    this.table = page.getByTestId('compare-table');
    this.columns = page.getByTestId('compare-column');
    this.emptyState = page.getByTestId('compare-empty');
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

  /** A comparison row, addressed by its row header. */
  row(label: string): Locator {
    return this.table.locator('tbody tr').filter({ has: this.page.getByRole('rowheader', { name: label }) });
  }
}
