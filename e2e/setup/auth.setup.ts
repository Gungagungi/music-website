import { expect, test as setup } from '@playwright/test';

import { BASE_URL, STORAGE_STATE_PATH } from '@/config/env';
import { SEEDED_USERS } from '@/data/seed';

/**
 * Produces a signed-in browser state once, reused by the specs that opt into it
 * with `test.use({ storageState: STORAGE_STATE_PATH })`.
 *
 * It is not applied globally on purpose: half of this suite is about the guest
 * experience, and a project that silently signs everyone in would quietly stop
 * testing it.
 *
 * Authentication goes through the API rather than the login form — a hundred
 * specs re-testing the login page as a side effect is a hundred chances to fail
 * for a reason unrelated to what they assert.
 */
setup('créer l’état de session authentifiée', async ({ request, context }) => {
  const response = await request.post('/api/auth/login', {
    data: {
      email: SEEDED_USERS.withOrders.email,
      password: SEEDED_USERS.withOrders.password,
    },
  });

  expect(response.status(), await response.text()).toBe(200);
  const { token } = (await response.json()) as { token: string };

  await context.addCookies([
    { name: 'fretline_token', value: token, url: BASE_URL, httpOnly: true, sameSite: 'Lax' },
  ]);

  await context.storageState({ path: STORAGE_STATE_PATH });
});
