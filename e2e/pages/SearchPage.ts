import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { ProductCardComponent } from '@/pages/components/ProductCardComponent';

export class SearchPage extends BasePage {
  readonly heading: Locator;
  readonly resultCount: Locator;
  readonly cards: Locator;
  readonly emptyState: Locator;
  readonly prompt: Locator;
  readonly sortSelect: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('search-title');
    this.resultCount = page.getByTestId('result-count-value');
    this.cards = page.getByTestId('product-card');
    this.emptyState = page.getByTestId('empty-results');
    this.prompt = page.getByTestId('search-prompt');
    this.sortSelect = page.getByTestId('sort-select');
  }

  protected path(): string {
    return '/recherche';
  }

  searchFor(term: string) {
    return this.open({ q: term });
  }

  card(index: number): ProductCardComponent {
    return new ProductCardComponent(this.cards.nth(index));
  }

  async visibleResultCount(): Promise<number> {
    return Number.parseInt((await this.resultCount.innerText()).trim(), 10);
  }
}
