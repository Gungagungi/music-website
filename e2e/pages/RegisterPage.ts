import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import type { NewUser } from '@/data/builders/UserBuilder';

export class RegisterPage extends BasePage {
  readonly heading: Locator;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('register-title');
    this.firstNameField = page.getByTestId('field-firstName');
    this.lastNameField = page.getByTestId('field-lastName');
    this.emailField = page.getByTestId('field-email');
    this.passwordField = page.getByTestId('field-password');
    this.submit = page.getByTestId('auth-submit');
    this.error = page.getByTestId('auth-error');
  }

  protected path(): string {
    return '/compte/inscription';
  }

  async register(user: NewUser): Promise<void> {
    await this.firstNameField.fill(user.firstName);
    await this.lastNameField.fill(user.lastName);
    await this.emailField.fill(user.email);
    await this.passwordField.fill(user.password);
    await this.submit.click();
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`error-${field}`);
  }
}
