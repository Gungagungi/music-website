import { AddressBuilder } from '@/data/builders/AddressBuilder';
import type { Address } from '@/data/builders/AddressBuilder';

export interface OrderPayload {
  email?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: 'carte' | 'virement' | 'paypal';
  acceptTerms: boolean;
}

/** Builder for `POST /api/orders` payloads. Valid by default, broken on request. */
export class OrderBuilder {
  private payload: OrderPayload;

  constructor() {
    this.payload = {
      shippingAddress: new AddressBuilder().build(),
      paymentMethod: 'carte',
      acceptTerms: true,
    };
  }

  /** Guest checkout: the API requires an e-mail when no bearer token is sent. */
  asGuest(email: string): this {
    this.payload.email = email;
    return this;
  }

  withShippingAddress(address: Address): this {
    this.payload.shippingAddress = address;
    return this;
  }

  withSeparateBillingAddress(address: Address): this {
    this.payload.billingAddress = address;
    return this;
  }

  withPaymentMethod(method: 'carte' | 'virement' | 'paypal'): this {
    this.payload.paymentMethod = method;
    return this;
  }

  withoutAcceptingTerms(): this {
    this.payload.acceptTerms = false;
    return this;
  }

  build(): OrderPayload {
    return structuredClone(this.payload);
  }
}
