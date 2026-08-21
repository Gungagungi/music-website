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
   * Le libellé du bouton nomme le thème vers lequel il bascule, jamais celui
   * qui est actif : c'est donc l'inverse du thème courant, et le lire est la
   * façon la plus directe de constater le thème appliqué sans dépendre d'une
   * valeur de couleur.
   */
  async themeToggleLabel(): Promise<string> {
    return (await this.themeToggle.innerText()).trim();
  }

  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
  }

  async cartItemCount(): Promise<number> {
    return Number.parseInt((await this.cartCount.innerText()).trim(), 10);
  }
}
