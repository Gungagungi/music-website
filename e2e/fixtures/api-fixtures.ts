import { test as base } from '@playwright/test';

import { ApiClient } from '@/api/ApiClient';
import { UserBuilder } from '@/data/builders/UserBuilder';
import type { NewUser } from '@/data/builders/UserBuilder';

interface ApiFixtures {
  api: ApiClient;
  /** Second, independent client — for the "another user cannot read this" cases. */
  otherApi: ApiClient;
  authedApi: ApiClient;
  authedUser: { credentials: NewUser; token: string; userId: string };
}

/**
 * API-only test object.
 *
 * It deliberately does not pull in the page-object fixtures: an API spec that
 * never touches `page` never starts a browser, which is why the API project
 * finishes in seconds and can run on a runner without browser dependencies.
 */
export const test = base.extend<ApiFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },

  /**
   * A genuinely independent client, with its own cookie jar.
   *
   * Reusing the `request` fixture here would hand both clients the same
   * cookies — including the guest cart id — so "another user cannot see my
   * cart" would pass for the wrong reason, or fail for the wrong one.
   */
  otherApi: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL });
    await use(new ApiClient(context));
    await context.dispose();
  },

  authedUser: async ({ request }, use) => {
    const credentials = new UserBuilder().build();
    const { token, userId } = await new ApiClient(request).registerAndAuthenticate(credentials);
    await use({ credentials, token, userId });
  },

  authedApi: async ({ playwright, baseURL, authedUser }, use) => {
    const context = await playwright.request.newContext({ baseURL });
    await use(new ApiClient(context).withToken(authedUser.token));
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
