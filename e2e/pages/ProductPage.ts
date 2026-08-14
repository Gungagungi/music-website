import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { ProductCardComponent } from '@/pages/components/ProductCardComponent';

export class ProductPage extends BasePage {
  readonly root: Locator;
  readonly heading: Locator;
  readonly brand: Locator;
  readonly sku: Locator;
  readonly image: Locator;
  readonly description: Locator;
  readonly price: Locator;
  readonly listPrice: Locator;
  readonly discountBadge: Locator;
  readonly availability: Locator;
  readonly leftHandedBadge: Locator;
  readonly specs: Locator;
  readonly reviews: Locator;
  readonly noReviews: Locator;
  readonly colorSelect: Locator;
  readonly quantityInput: Locator;
  readonly addToCartButton: Locator;
  readonly addToCartStatus: Locator;
  readonly compareLink: Locator;
  readonly relatedProducts: Locator;

  private slug = '';

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('product-page');
    this.heading = page.getByTestId('product-title');
    this.brand = page.getByTestId('product-brand');
    this.sku = page.getByTestId('product-sku');
    this.image = page.getByTestId('product-image');
    this.description = page.getByTestId('product-description');
    this.price = page.getByTestId('product-price');
    this.listPrice = page.getByTestId('product-list-price');
    this.discountBadge = page.getByTestId('product-discount');
    this.availability = page.getByTestId('product-availability');
    this.leftHandedBadge = page.getByTestId('left-handed-badge');
    this.specs = page.getByTestId('product-specs');
    this.reviews = page.getByTestId('review-item');
    this.noReviews = page.getByTestId('no-reviews');
    this.colorSelect = page.getByTestId('product-color');
    this.quantityInput = page.getByTestId('product-quantity');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.addToCartStatus = page.getByTestId('add-to-cart-status');
    this.compareLink = page.getByTestId('add-to-compare');
    this.relatedProducts = page.getByTestId('related-products').getByTestId('product-card');
  }

  protected path(): string {
    return `/p/${this.slug}`;
  }

  openProduct(slug: string): Promise<Response | null> {
    this.slug = slug;
    return this.open();
  }

  async stockLevel(): Promise<number> {
    return Number.parseInt((await this.availability.getAttribute('data-stock')) ?? '0', 10);
  }

  /**
   * Adds to cart and waits for the live region to settle. The status element is
   * always present and carries `data-status`, so the wait is on a real state
   * change rather than on a timeout.
   */
  async addToCart(options: { quantity?: number; color?: string } = {}): Promise<'success' | 'error'> {
    if (options.color) await this.colorSelect.selectOption(options.color);
    if (options.quantity) await this.quantityInput.fill(String(options.quantity));

    await this.addToCartButton.click();
    await this.page.locator('[data-testid="add-to-cart-status"]:not([data-status="idle"])').waitFor();

    return (await this.addToCartStatus.getAttribute('data-status')) === 'success' ? 'success' : 'error';
  }

  relatedCard(index: number): ProductCardComponent {
    return new ProductCardComponent(this.relatedProducts.nth(index));
  }

  specValue(label: string): Locator {
    return this.specs.locator('div').filter({ hasText: label }).locator('dd');
  }
}
