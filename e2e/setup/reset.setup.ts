import { expect, test as setup } from '@playwright/test';

import { ApiClient } from '@/api/ApiClient';
import { CATALOG_TOTAL_PRODUCTS } from '@/data/seed';

/**
 * Restores the application to its seeded state, exactly once per run.
 *
 * Deliberately *not* done per-test: the database is process-wide, so a reset
 * fired from one worker would wipe the accounts and carts another worker is
 * halfway through using. The isolation strategy is the opposite — reset once at
 * the start, then have every spec create data it alone owns (see the
 * `registeredUser` and `cartWith` fixtures).
 */
setup('remettre la base de données à son état initial', async ({ request }) => {
  const api = new ApiClient(request);

  const health = await api.health();
  expect(health.status(), 'L’application doit répondre avant de lancer la suite.').toBe(200);

  const healthBody = (await health.json()) as { testMode: boolean };
  expect(
    healthBody.testMode,
    'L’application doit tourner avec E2E_TEST_MODE=1 pour exposer /api/test/*.',
  ).toBe(true);

  const response = await api.resetDatabase();
  expect(response.status(), await response.text()).toBe(200);

  const body = (await response.json()) as { products: number; orders: number; carts: number };
  expect(body.products).toBe(CATALOG_TOTAL_PRODUCTS);
  expect(body.orders).toBe(0);
  expect(body.carts).toBe(0);
});
