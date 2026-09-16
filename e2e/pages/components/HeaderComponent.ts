import type { Locator, Page } from '@playwright/test';
import { fillOnceHydrated } from '@/utils/forms';

/** Site header: search, account entry point and the cart badge. */
export class HeaderComponent {
  readonly root: Locator;
  readonly logo: Locator;
  readonly searchInput: Locator;
  readonly searchSubmit: Locator;
  readonly loginLink: Locator;
  readonly accountLink: Locator;
  readonly cartLink: Locator;
  readonly cartCount: Locator;
  readonly categoryNav: Locator;
  readonly themeToggle: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('site-header');
    this.logo = page.getByTestId('logo');
    this.searchInput = page.getByRole('searchbox', { name: 'Rechercher un produit' });
    this.searchSubmit = page.getByTestId('search-submit');
    this.loginLink = page.getByTestId('login-link');
    this.accountLink = page.getByTestId('account-link');
    this.cartLink = page.getByTestId('cart-link');
    this.cartCount = page.getByTestId('cart-count');
    this.categoryNav = page.getByTestId('category-nav');
    this.themeToggle = page.getByTestId('theme-toggle');
  }

  async search(term: string): Promise<void> {
    await fillOnceHydrated(this.searchInput, term);
    await this.searchSubmit.click();
  }

  async openCategory(slug: string): Promise<void> {
    await this.page.getByTestId(`nav-${slug}`).click();
  }

  /**
   * Mode shown by the button — "Système", "Clair" or "Sombre".
   *
   * All three labels are in the DOM, the cascade only shows one: reading the
   * only visible one amounts to reading the state actually applied, without
   * going through a colour value or through the attribute the test is precisely
   * trying to check elsewhere.
   */
  async themeMode(): Promise<string> {
    return (await this.themeToggle.locator('[data-mode]:visible').innerText()).trim();
  }

  /** Moves one step forward in the Système → Clair → Sombre cycle. */
  async cycleTheme(): Promise<void> {
    await this.themeToggle.click();
  }

  async cartItemCount(): Promise<number> {
    return Number.parseInt((await this.cartCount.innerText()).trim(), 10);
  }
}
