import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { fillOnceHydrated } from '@/utils/forms';

/** Scopes one row of the cart table. */
export class CartLine {
  readonly name: Locator;
  readonly color: Locator;
  readonly unitPrice: Locator;
  readonly quantity: Locator;
  readonly lineTotal: Locator;
  readonly remove: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('cart-line-name');
    this.color = root.getByTestId('cart-line-color');
    this.unitPrice = root.getByTestId('cart-line-unit-price');
    this.quantity = root.getByTestId('cart-line-quantity');
    this.lineTotal = root.getByTestId('cart-line-total');
    this.remove = root.getByTestId('cart-line-remove');
  }

  async setQuantity(value: number): Promise<void> {
    await fillOnceHydrated(this.quantity, String(value));
    // The input fires on change and the row re-renders from the API response;
    // waiting for the field to settle avoids racing the refresh.
    await this.quantity.blur();
  }
}

export class CartPage extends BasePage {
  readonly heading: Locator;
  readonly lines: Locator;
  readonly emptyState: Locator;
  readonly emptyStateCta: Locator;
  readonly summary: Locator;
  readonly subtotal: Locator;
  readonly discount: Locator;
  readonly shipping: Locator;
  readonly vat: Locator;
  readonly total: Locator;
  readonly couponInput: Locator;
  readonly couponSubmit: Locator;
  readonly couponError: Locator;
  readonly appliedCoupon: Locator;
  readonly removeCoupon: Locator;
  readonly checkoutLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('cart-title');
    this.lines = page.getByTestId('cart-line');
    this.emptyState = page.getByTestId('empty-cart');
    this.emptyStateCta = page.getByTestId('empty-cart-cta');
    this.summary = page.getByTestId('cart-summary');
    this.subtotal = page.getByTestId('summary-subtotal');
    this.discount = page.getByTestId('summary-discount');
    this.shipping = page.getByTestId('summary-shipping');
    this.vat = page.getByTestId('summary-vat');
    this.total = page.getByTestId('summary-total');
    this.couponInput = page.getByTestId('coupon-input');
    this.couponSubmit = page.getByTestId('coupon-submit');
    this.couponError = page.getByTestId('coupon-error');
    this.appliedCoupon = page.getByTestId('applied-coupon');
    this.removeCoupon = page.getByTestId('remove-coupon');
    this.checkoutLink = page.getByTestId('checkout-link');
  }

  protected path(): string {
    return '/panier';
  }

  line(index: number): CartLine {
    return new CartLine(this.lines.nth(index));
  }

  /** `data-sku` sits on the row root itself, so this selects, it does not filter. */
  lineBySku(sku: string): CartLine {
    return new CartLine(this.page.locator(`[data-testid="cart-line"][data-sku="${sku}"]`));
  }

  async applyCoupon(code: string): Promise<void> {
    await fillOnceHydrated(this.couponInput, code);
    await this.couponSubmit.click();
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutLink.click();
    await this.page.waitForURL('**/commande');
  }
}
