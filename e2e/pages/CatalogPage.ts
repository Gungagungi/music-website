import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { FacetPanelComponent } from '@/pages/components/FacetPanelComponent';
import { ProductCardComponent } from '@/pages/components/ProductCardComponent';

export class CatalogPage extends BasePage {
  readonly facets: FacetPanelComponent;
  readonly heading: Locator;
  readonly resultCount: Locator;
  readonly activeFilterCount: Locator;
  readonly sortSelect: Locator;
  readonly cards: Locator;
  readonly prices: Locator;
  readonly emptyState: Locator;
  readonly emptyStateReset: Locator;
  readonly pagination: Locator;
  readonly breadcrumb: Locator;

  private categorySlug = 'guitares-electriques';

  constructor(page: Page) {
    super(page);
    this.facets = new FacetPanelComponent(page);
    this.heading = page.getByTestId('category-title');
    this.resultCount = page.getByTestId('result-count-value');
    this.activeFilterCount = page.getByTestId('active-filter-count');
    this.sortSelect = page.getByTestId('sort-select');
    this.cards = page.getByTestId('product-card');
    this.prices = page.getByTestId('product-card').getByTestId('product-price');
    this.emptyState = page.getByTestId('empty-results');
    this.emptyStateReset = page.getByTestId('empty-results-reset');
    this.pagination = page.getByTestId('pagination');
    this.breadcrumb = page.getByTestId('breadcrumb');
  }

  protected path(): string {
    return `/c/${this.categorySlug}`;
  }

  openCategory(slug: string, query: Record<string, string | string[]> = {}): Promise<Response | null> {
    this.categorySlug = slug;
    return this.open(query);
  }

  card(index: number): ProductCardComponent {
    return new ProductCardComponent(this.cards.nth(index));
  }

  /** `data-slug` sits on the card root itself, so this selects, it does not filter. */
  cardBySlug(slug: string): ProductCardComponent {
    return new ProductCardComponent(this.page.locator(`[data-testid="product-card"][data-slug="${slug}"]`));
  }

  async visibleResultCount(): Promise<number> {
    return Number.parseInt((await this.resultCount.innerText()).trim(), 10);
  }

  async sortBy(value: 'pertinence' | 'prix-asc' | 'prix-desc' | 'note' | 'nouveautes'): Promise<void> {
    await this.sortSelect.selectOption(value);
    await this.page.waitForURL((url) =>
      value === 'pertinence' ? !url.searchParams.has('sort') : url.searchParams.get('sort') === value,
    );
  }

  async goToPage(pageNumber: number): Promise<void> {
    await this.page.getByTestId(`pagination-page-${pageNumber}`).click();
    await this.page.waitForURL((url) =>
      pageNumber === 1 ? !url.searchParams.has('page') : url.searchParams.get('page') === String(pageNumber),
    );
  }

  async nextPage(): Promise<void> {
    await this.page.getByTestId('pagination-next').click();
  }

  /** Slugs currently rendered, in display order — the unit sorting specs assert on. */
  async displayedSlugs(): Promise<string[]> {
    return this.cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-slug') ?? ''),
    );
  }

  async displayedPricesCents(): Promise<number[]> {
    return this.cards.evaluateAll((nodes) =>
      nodes.map((node) => Number.parseInt(node.getAttribute('data-price') ?? '0', 10)),
    );
  }
}
