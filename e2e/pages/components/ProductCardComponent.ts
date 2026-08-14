import type { Locator } from '@playwright/test';

/**
 * Wraps a single card in a product grid.
 *
 * Grids are the place where "the second result" quietly becomes "a different
 * second result"; scoping every sub-locator to one card root keeps a spec from
 * accidentally reading the price of one product and the name of another.
 */
export class ProductCardComponent {
  readonly name: Locator;
  readonly brand: Locator;
  readonly price: Locator;
  readonly listPrice: Locator;
  readonly discountBadge: Locator;
  readonly availability: Locator;
  readonly rating: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('product-name');
    this.brand = root.getByTestId('product-brand');
    this.price = root.getByTestId('product-price');
    this.listPrice = root.getByTestId('product-list-price');
    this.discountBadge = root.getByTestId('product-discount');
    this.availability = root.getByTestId('product-availability');
    this.rating = root.getByTestId('rating');
  }

  async slug(): Promise<string> {
    return (await this.root.getAttribute('data-slug')) ?? '';
  }

  async sku(): Promise<string> {
    return (await this.root.getAttribute('data-sku')) ?? '';
  }

  /** Price straight from the DOM attribute, in cents — no string parsing needed. */
  async priceCents(): Promise<number> {
    return Number.parseInt((await this.root.getAttribute('data-price')) ?? '0', 10);
  }

  async open(): Promise<void> {
    await this.name.click();
  }
}
