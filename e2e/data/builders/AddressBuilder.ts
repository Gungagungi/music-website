import { faker } from '@faker-js/faker';

export interface Address {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone?: string | null;
}

/**
 * Builder for shipping addresses.
 *
 * The point of a builder here is not to save typing — it is that a spec should
 * declare only the field it cares about. `new AddressBuilder().withPostalCode('7500').build()`
 * reads as "an otherwise valid address with a bad postcode", which is exactly
 * what the validation test is about. Everything else stays valid by default, so
 * the test cannot fail for a reason it did not intend to exercise.
 */
export class AddressBuilder {
  private address: Address;

  constructor() {
    faker.seed(); // fresh entropy per builder; determinism comes from the app, not the fixtures
    this.address = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      line1: `${faker.number.int({ min: 1, max: 200 })} rue des Luthiers`,
      line2: null,
      postalCode: String(faker.number.int({ min: 10000, max: 95999 })),
      city: faker.location.city(),
      country: 'France',
      phone: `0${faker.number.int({ min: 1, max: 7 })}${faker.string.numeric(8)}`,
    };
  }

  withFirstName(value: string): this {
    this.address.firstName = value;
    return this;
  }

  withLastName(value: string): this {
    this.address.lastName = value;
    return this;
  }

  withLine1(value: string): this {
    this.address.line1 = value;
    return this;
  }

  withLine2(value: string | null): this {
    this.address.line2 = value;
    return this;
  }

  withPostalCode(value: string): this {
    this.address.postalCode = value;
    return this;
  }

  withCity(value: string): this {
    this.address.city = value;
    return this;
  }

  withCountry(value: string): this {
    this.address.country = value;
    return this;
  }

  withPhone(value: string | null): this {
    this.address.phone = value;
    return this;
  }

  /** Drops a required field to exercise server-side validation. */
  without(field: 'firstName' | 'lastName' | 'line1' | 'postalCode' | 'city'): this {
    this.address[field] = '';
    return this;
  }

  build(): Address {
    return { ...this.address };
  }
}
