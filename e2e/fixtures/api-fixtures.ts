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

  otherApi: async ({ request }, use) => {
    await use(new ApiClient(request));
  },

  authedUser: async ({ request }, use) => {
    const credentials = new UserBuilder().build();
    const { token, userId } = await new ApiClient(request).registerAndAuthenticate(credentials);
    await use({ credentials, token, userId });
  },

  authedApi: async ({ request, authedUser }, use) => {
    await use(new ApiClient(request).withToken(authedUser.token));
  },
});

export { expect } from '@playwright/test';
