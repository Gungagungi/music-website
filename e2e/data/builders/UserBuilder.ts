import { faker } from '@faker-js/faker';

import { uniqueEmail, validPassword } from '@/utils/unique';

export interface NewUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Builder for registration payloads.
 *
 * Defaults are always valid and always unique, so two workers registering at
 * the same moment cannot collide. Invalid variants are opt-in and named after
 * the rule they break, which keeps the intent visible at the call site.
 */
export class UserBuilder {
  private user: NewUser;

  constructor() {
    this.user = {
      email: uniqueEmail(),
      password: validPassword(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    };
  }

  withEmail(value: string): this {
    this.user.email = value;
    return this;
  }

  withPassword(value: string): this {
    this.user.password = value;
    return this;
  }

  withFirstName(value: string): this {
    this.user.firstName = value;
    return this;
  }

  withLastName(value: string): this {
    this.user.lastName = value;
    return this;
  }

  /** Fails the `email` format rule. */
  withMalformedEmail(): this {
    this.user.email = 'pas-une-adresse';
    return this;
  }

  /** Fails the 8-character minimum. */
  withTooShortPassword(): this {
    this.user.password = 'Ab1!';
    return this;
  }

  /** Long enough, but carries no digit. */
  withPasswordWithoutDigit(): this {
    this.user.password = 'MotDePasseSansChiffre';
    return this;
  }

  build(): NewUser {
    return { ...this.user };
  }
}
