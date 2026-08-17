import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import type { Address } from '@/data/builders/AddressBuilder';
import { fillOnceHydrated } from '@/utils/forms';

export class CheckoutPage extends BasePage {
  readonly heading: Locator;
  readonly steps: Locator;
  readonly emptyState: Locator;
  readonly guestNotice: Locator;

  // Step 1 — shipping
  readonly shippingForm: Locator;
  readonly emailField: Locator;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly line1Field: Locator;
  readonly line2Field: Locator;
  readonly postalCodeField: Locator;
  readonly cityField: Locator;
  readonly phoneField: Locator;
  readonly shippingContinue: Locator;

  // Step 2 — payment
  readonly paymentForm: Locator;
  readonly paymentContinue: Locator;
  readonly paymentBack: Locator;

  // Step 3 — review
  readonly reviewStep: Locator;
  readonly reviewAddress: Locator;
  readonly reviewPayment: Locator;
  readonly acceptTerms: Locator;
  readonly placeOrder: Locator;
  readonly checkoutError: Locator;
  readonly termsError: Locator;

  readonly summaryTotal: Locator;
  readonly summarySubtotal: Locator;
  readonly summaryShipping: Locator;
  readonly summaryDiscount: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('checkout-title');
    this.steps = page.getByTestId('checkout-steps');
    this.emptyState = page.getByTestId('checkout-empty');
    this.guestNotice = page.getByTestId('guest-notice');

    this.shippingForm = page.getByTestId('shipping-form');
    this.emailField = page.getByTestId('field-email');
    this.firstNameField = page.getByTestId('field-firstName');
    this.lastNameField = page.getByTestId('field-lastName');
    this.line1Field = page.getByTestId('field-line1');
    this.line2Field = page.getByTestId('field-line2');
    this.postalCodeField = page.getByTestId('field-postalCode');
    this.cityField = page.getByTestId('field-city');
    this.phoneField = page.getByTestId('field-phone');
    this.shippingContinue = page.getByTestId('shipping-continue');

    this.paymentForm = page.getByTestId('payment-form');
    this.paymentContinue = page.getByTestId('payment-continue');
    this.paymentBack = page.getByTestId('payment-back');

    this.reviewStep = page.getByTestId('review-step');
    this.reviewAddress = page.getByTestId('review-address');
    this.reviewPayment = page.getByTestId('review-payment');
    this.acceptTerms = page.getByTestId('accept-terms');
    this.placeOrder = page.getByTestId('place-order');
    this.checkoutError = page.getByTestId('checkout-error');
    this.termsError = page.getByTestId('error-acceptTerms');

    this.summaryTotal = page.getByTestId('checkout-summary').getByTestId('summary-total');
    this.summarySubtotal = page.getByTestId('checkout-summary').getByTestId('summary-subtotal');
    this.summaryShipping = page.getByTestId('checkout-summary').getByTestId('summary-shipping');
    this.summaryDiscount = page.getByTestId('checkout-summary').getByTestId('summary-discount');
  }

  protected path(): string {
    return '/commande';
  }

  /** Field-level validation message, e.g. `fieldError('postalCode')`. */
  fieldError(field: string): Locator {
    return this.page.getByTestId(`error-${field}`);
  }

  step(name: 'livraison' | 'paiement' | 'recapitulatif'): Locator {
    return this.page.getByTestId(`checkout-step-${name}`);
  }

  async fillShipping(address: Address, email?: string): Promise<void> {
    if (email !== undefined) await fillOnceHydrated(this.emailField, email);
    await fillOnceHydrated(this.firstNameField, address.firstName);
    await fillOnceHydrated(this.lastNameField, address.lastName);
    await fillOnceHydrated(this.line1Field, address.line1);
    if (address.line2) await fillOnceHydrated(this.line2Field, address.line2);
    await fillOnceHydrated(this.postalCodeField, address.postalCode);
    await fillOnceHydrated(this.cityField, address.city);
    if (address.phone) await fillOnceHydrated(this.phoneField, address.phone);
  }

  async selectPaymentMethod(method: 'carte' | 'virement' | 'paypal'): Promise<void> {
    await this.page.getByTestId(`payment-${method}`).check();
  }

  /**
   * Runs the whole funnel. Individual steps stay accessible for the specs that
   * need to stop halfway — this is the convenience path, not the only path.
   */
  async completeCheckout(options: {
    address: Address;
    email?: string;
    paymentMethod?: 'carte' | 'virement' | 'paypal';
  }): Promise<void> {
    await this.fillShipping(options.address, options.email);
    await this.shippingContinue.click();

    if (options.paymentMethod) await this.selectPaymentMethod(options.paymentMethod);
    await this.paymentContinue.click();

    await this.acceptTerms.check();
    await this.placeOrder.click();
    await this.page.waitForURL('**/commande/confirmation/**');
  }
}
