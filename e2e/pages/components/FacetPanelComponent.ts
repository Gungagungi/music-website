import type { Locator, Page } from '@playwright/test';
import { fillOnceHydrated } from '@/utils/forms';

/**
 * The catalog filter sidebar.
 *
 * Every interaction here triggers a client-side navigation, so each action
 * waits for the URL to actually carry the new filter before returning. Without
 * that, the next assertion races the router and the spec becomes flaky on a
 * slower machine — the single most common source of false failures in a
 * faceted-search suite.
 */
export class FacetPanelComponent {
  readonly root: Locator;
  readonly clearAll: Locator;
  readonly minPrice: Locator;
  readonly maxPrice: Locator;
  readonly applyPrice: Locator;
  readonly inStockOnly: Locator;
  readonly onSaleOnly: Locator;
  readonly leftHandedOnly: Locator;
  readonly minRating: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('facet-panel');
    this.clearAll = page.getByTestId('facet-clear-all');
    this.minPrice = page.getByTestId('facet-min-price');
    this.maxPrice = page.getByTestId('facet-max-price');
    this.applyPrice = page.getByTestId('facet-apply-price');
    this.inStockOnly = page.getByTestId('facet-in-stock');
    this.onSaleOnly = page.getByTestId('facet-on-sale');
    this.leftHandedOnly = page.getByTestId('facet-left-handed');
    this.minRating = page.getByTestId('facet-min-rating');
  }

  brandCheckbox(brand: string): Locator {
    return this.page.getByTestId(`facet-brand-${slugifyBrand(brand)}`);
  }

  async selectBrand(brand: string): Promise<void> {
    await this.brandCheckbox(brand).check();
    await this.page.waitForURL((url) => url.searchParams.getAll('brand').includes(brand));
  }

  async deselectBrand(brand: string): Promise<void> {
    await this.brandCheckbox(brand).uncheck();
    await this.page.waitForURL((url) => !url.searchParams.getAll('brand').includes(brand));
  }

  /** Bounds are expressed in euros, matching what the shopper types. */
  async setPriceRange(minEuros: number | null, maxEuros: number | null): Promise<void> {
    await fillOnceHydrated(this.minPrice, minEuros === null ? '' : String(minEuros));
    await fillOnceHydrated(this.maxPrice, maxEuros === null ? '' : String(maxEuros));
    await this.applyPrice.click();
    await this.page.waitForURL((url) =>
      minEuros === null
        ? !url.searchParams.has('minPrice')
        : url.searchParams.get('minPrice') === String(minEuros * 100),
    );
  }

  async toggleInStockOnly(): Promise<void> {
    await this.setFlag(this.inStockOnly, 'inStock');
  }

  async toggleOnSaleOnly(): Promise<void> {
    await this.setFlag(this.onSaleOnly, 'onSale');
  }

  async toggleLeftHandedOnly(): Promise<void> {
    await this.setFlag(this.leftHandedOnly, 'leftHanded');
  }

  async setMinRating(value: '' | '3' | '4'): Promise<void> {
    await this.minRating.selectOption(value);
    await this.page.waitForURL((url) =>
      value === '' ? !url.searchParams.has('minRating') : url.searchParams.get('minRating') === value,
    );
  }

  async clearAllFilters(): Promise<void> {
    await this.clearAll.click();
    await this.page.waitForURL((url) => !url.searchParams.has('brand') && !url.searchParams.has('minPrice'));
  }

  private async setFlag(locator: Locator, param: string): Promise<void> {
    const wasChecked = await locator.isChecked();
    await locator.setChecked(!wasChecked);
    await this.page.waitForURL((url) =>
      wasChecked ? !url.searchParams.has(param) : url.searchParams.get(param) === 'true',
    );
  }
}

function slugifyBrand(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
