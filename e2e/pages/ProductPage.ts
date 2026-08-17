import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { ProductCardComponent } from '@/pages/components/ProductCardComponent';
import { fillOnceHydrated } from '@/utils/forms';

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
    // Prices, availability and brand labels also live on the related-product
    // cards at the bottom of the page, so everything about *this* product is
    // scoped to the buy box or the identity block. Unscoped test ids here would
    // resolve to five elements and fail on strict mode — correctly.
    const buyBox = page.getByTestId('product-buybox');
    const identity = page.getByTestId('product-identity');

    this.heading = page.getByTestId('product-title');
    this.brand = identity.getByTestId('product-brand');
    this.sku = page.getByTestId('product-sku');
    this.image = page.getByTestId('product-image');
    this.description = page.getByTestId('product-description');
    this.price = buyBox.getByTestId('product-price');
    this.listPrice = buyBox.getByTestId('product-list-price');
    this.discountBadge = buyBox.getByTestId('product-discount');
    this.availability = buyBox.getByTestId('product-availability');
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

    // Controlled input: a fill that lands before hydration is discarded, and
    // the cart silently receives quantity 1. See `fillOnceHydrated` — asserting
    // the value is not enough, the write itself has to be retried.
    if (options.quantity) await fillOnceHydrated(this.quantityInput, String(options.quantity));

    await this.addToCartButton.click();
    await this.page.locator('[data-testid="add-to-cart-status"]:not([data-status="idle"])').waitFor();

    // Success triggers `router.refresh()` so the header badge catches up. On
    // Firefox, navigating away while that refresh is in flight aborts it with
    // NS_BINDING_ABORTED, which surfaces as a failed `page.goto` in the *next*
    // step. Letting it settle keeps the failure where it belongs.
    await this.page.waitForLoadState('networkidle');

    return (await this.addToCartStatus.getAttribute('data-status')) === 'success' ? 'success' : 'error';
  }

  relatedCard(index: number): ProductCardComponent {
    return new ProductCardComponent(this.relatedProducts.nth(index));
  }

  specValue(label: string): Locator {
    return this.specs.locator('div').filter({ hasText: label }).locator('dd');
  }
}
