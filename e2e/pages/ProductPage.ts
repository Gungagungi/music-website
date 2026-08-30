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
  readonly reviewsSummary: Locator;
  readonly reviewsCount: Locator;
  readonly reviewHistogram: Locator;
  readonly reviewSort: Locator;
  readonly reviewPagination: Locator;
  readonly reviewForm: Locator;
  readonly reviewStatus: Locator;
  readonly reviewSigninHint: Locator;
  readonly verifiedBadges: Locator;
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
    this.reviewsSummary = page.getByTestId('reviews-summary');
    this.reviewsCount = page.getByTestId('reviews-count');
    this.reviewHistogram = page.getByTestId('review-histogram');
    this.reviewSort = page.getByTestId('review-sort');
    this.reviewPagination = page.getByTestId('pagination');
    this.reviewForm = page.getByTestId('review-form');
    this.reviewStatus = page.getByTestId('review-status');
    this.reviewSigninHint = page.getByTestId('review-signin-hint');
    this.verifiedBadges = page.getByTestId('verified-badge');
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

  openProduct(
    slug: string,
    query: Record<string, string | string[]> = {},
  ): Promise<Response | null> {
    this.slug = slug;
    return this.open(query);
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

  /** One bar of the rating histogram; it doubles as the filter control. */
  histogramBar(level: number): Locator {
    return this.page.getByTestId(`histogram-bar-${level}`);
  }

  /** Count of reviews the histogram reports for a level, filter-independent. */
  async histogramCount(level: number): Promise<number> {
    return Number.parseInt((await this.histogramBar(level).getAttribute('data-count')) ?? '0', 10);
  }

  /**
   * Sorts the review list and waits for the server-rendered result.
   *
   * The select pushes a new URL, so the wait is on the URL the block will be
   * rendered from — not on a timeout, and not on the list itself, which may
   * legitimately come back identical.
   */
  async sortReviews(value: string): Promise<void> {
    await this.reviewSort.selectOption(value);
    await this.page.waitForURL(value === 'recents' ? /\/p\// : new RegExp(`avis-tri=${value}`));
    await this.waitForHydration();
  }

  /** Publishes a review; returns what the status region ended up saying. */
  async submitReview(input: {
    rating: number;
    title: string;
    body: string;
  }): Promise<'success' | 'error'> {
    await this.page.getByTestId('review-rating').selectOption(String(input.rating));
    await fillOnceHydrated(this.page.getByTestId('review-title'), input.title);
    await fillOnceHydrated(this.page.getByTestId('review-body'), input.body);
    await this.page.getByTestId('review-submit').click();
    await this.page.locator('[data-testid="review-status"]:not([data-status="idle"])').waitFor();
    await this.page.waitForLoadState('networkidle');
    return (await this.reviewStatus.getAttribute('data-status')) === 'success' ? 'success' : 'error';
  }

  specValue(label: string): Locator {
    return this.specs.locator('div').filter({ hasText: label }).locator('dd');
  }
}
