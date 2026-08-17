import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { fillOnceHydrated } from '@/utils/forms';

export class LoginPage extends BasePage {
  readonly heading: Locator;
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('login-title');
    this.emailField = page.getByTestId('field-email');
    this.passwordField = page.getByTestId('field-password');
    this.submit = page.getByTestId('auth-submit');
    this.error = page.getByTestId('auth-error');
    this.registerLink = page.getByTestId('register-link');
  }

  protected path(): string {
    return '/compte/connexion';
  }

  async login(email: string, password: string): Promise<void> {
    await fillOnceHydrated(this.emailField, email);
    await fillOnceHydrated(this.passwordField, password);
    await this.submit.click();
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`error-${field}`);
  }
}
