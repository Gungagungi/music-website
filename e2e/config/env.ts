/**
 * Single source of truth for everything the suite reads from the environment.
 *
 * Scattering `process.env.FOO` across specs is how a suite ends up passing
 * locally and failing in CI for reasons nobody can trace. One module, one place
 * to look, defaults that make `npx playwright test` work with no setup at all.
 */

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/** Shared secret expected by the app's `/api/test/*` endpoints. */
export const TEST_API_TOKEN = process.env.TEST_API_TOKEN ?? 'fretline-e2e-token';

export const IS_CI = Boolean(process.env.CI);

/** When set, the app serves its three deliberately seeded defects. */
export const SEED_BUGS = process.env.SEED_BUGS === '1';

export const STORAGE_STATE_PATH = '.auth/user.json';

export const TIMEOUTS = {
  test: 30_000,
  expect: 7_000,
  action: 10_000,
  navigation: 20_000,
  webServer: 120_000,
} as const;
