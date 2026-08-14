import { test as base } from '@playwright/test';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

import { ApiClient } from '@/api/ApiClient';
import { BASE_URL } from '@/config/env';
import { UserBuilder } from '@/data/builders/UserBuilder';
import type { NewUser } from '@/data/builders/UserBuilder';
import { CartPage } from '@/pages/CartPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { ComparePage } from '@/pages/ComparePage';
import { ConfirmationPage } from '@/pages/ConfirmationPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { ProductPage } from '@/pages/ProductPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { SearchPage } from '@/pages/SearchPage';

export interface CartItemSpec {
  sku?: string;
  productId?: string;
  quantity?: number;
  color?: string | null;
}

export interface RegisteredUser {
  credentials: NewUser;
  token: string;
  userId: string;
}

interface Fixtures {
  // Page objects
  homePage: HomePage;
  catalogPage: CatalogPage;
  productPage: ProductPage;
  searchPage: SearchPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  confirmationPage: ConfirmationPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  ordersPage: OrdersPage;
  comparePage: ComparePage;

  // API
  api: ApiClient;

  /** A brand-new account, unique to this test, already authenticated on `api`. */
  registeredUser: RegisteredUser;

  /** Signs the browser session in, by credentials, without going through the UI. */
  signInAs: (email: string, password: string) => Promise<string>;

  /**
   * Arranges cart contents through the API and hands the browser the resulting
   * cart, so a UI spec can start from "three items in the basket" in one line
   * instead of clicking through three product pages.
   */
  cartWith: (items: CartItemSpec[]) => Promise<string>;
}

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  catalogPage: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  confirmationPage: async ({ page }, use) => {
    await use(new ConfirmationPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  ordersPage: async ({ page }, use) => {
    await use(new OrdersPage(page));
  },
  comparePage: async ({ page }, use) => {
    await use(new ComparePage(page));
  },

  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },

  registeredUser: async ({ request }, use) => {
    // A dedicated account per test is what makes `fullyParallel` safe: no spec
    // can observe another spec's orders, cart or review history.
    const credentials = new UserBuilder().build();
    const client = new ApiClient(request);
    const { token, userId } = await client.registerAndAuthenticate(credentials);
    await use({ credentials, token, userId });
  },

  signInAs: async ({ context, request }, use) => {
    await use(async (email: string, password: string) => {
      const token = await tokenFor(request, email, password);
      await applyAuthCookie(context, token);
      return token;
    });
  },

  cartWith: async ({ context, request }, use) => {
    await use(async (items: CartItemSpec[]) => {
      const client = new ApiClient(request);
      for (const item of items) {
        await client.addToCartAndTrack({ quantity: 1, ...item });
      }
      const cartId = client.currentCartId;
      if (!cartId) throw new Error('Aucun panier créé : la liste d’articles était vide.');

      await context.addCookies([
        { name: 'fretline_cart', value: cartId, url: BASE_URL, httpOnly: true, sameSite: 'Lax' },
      ]);
      return cartId;
    });
  },
});

async function tokenFor(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await new ApiClient(request).login({ email, password });
  if (response.status() !== 200) {
    throw new Error(`Connexion impossible pour ${email} : HTTP ${response.status()}`);
  }
  const body = (await response.json()) as { token: string };
  return body.token;
}

async function applyAuthCookie(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    { name: 'fretline_token', value: token, url: BASE_URL, httpOnly: true, sameSite: 'Lax' },
  ]);
}

export { expect } from '@/utils/matchers';
