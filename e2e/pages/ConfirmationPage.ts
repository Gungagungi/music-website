import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';

export class ConfirmationPage extends BasePage {
  readonly root: Locator;
  readonly reference: Locator;
  readonly email: Locator;
  readonly lines: Locator;
  readonly subtotal: Locator;
  readonly discount: Locator;
  readonly shipping: Locator;
  readonly total: Locator;
  readonly address: Locator;
  readonly backToShop: Locator;

  private reference_ = '';
  private token = '';

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('order-confirmation');
    this.reference = page.getByTestId('order-reference');
    this.email = page.getByTestId('order-email');
    this.lines = page.getByTestId('order-lines');
    this.subtotal = page.getByTestId('order-subtotal');
    this.discount = page.getByTestId('order-discount');
    this.shipping = page.getByTestId('order-shipping');
    this.total = page.getByTestId('order-total');
    this.address = page.getByTestId('order-address');
    this.backToShop = page.getByTestId('back-to-shop');
  }

  protected path(): string {
    return `/commande/confirmation/${this.reference_}`;
  }

  openOrder(reference: string, accessToken?: string) {
    this.reference_ = reference;
    this.token = accessToken ?? '';
    return this.open(this.token ? { token: this.token } : {});
  }

  /** Order reference taken from the URL — handy right after a redirect. */
  referenceFromUrl(): string {
    return this.currentUrl.pathname.split('/').filter(Boolean).at(-1) ?? '';
  }
}
