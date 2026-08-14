import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

import { BASE_URL, IS_CI, STORAGE_STATE_PATH, TIMEOUTS } from './config/env';

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: 'reports/html', open: 'never' }],
  ['junit', { outputFile: 'reports/junit.xml' }],
  ['json', { outputFile: 'reports/results.json' }],
  ['./reporters/summary-reporter.ts'],
];

// Blob output is what makes sharded CI runs mergeable into a single report.
if (IS_CI) reporters.push(['blob', { outputDir: 'blob-report' }]);

/**
 * Suite topology.
 *
 * Projects split the suite along the two axes that actually matter: what is
 * being tested (API contract, UI journeys, accessibility, visual regression)
 * and where (three engines plus a mobile viewport). Splitting this way lets CI
 * run the fast, high-signal projects on every push and reserve the slow ones
 * for a matrix job — instead of one monolithic run that is either too slow to
 * gate a PR or too shallow to be worth gating on.
 *
 * `setup-db` runs first and reseeds the application; `setup-auth` then produces
 * a signed-in storage state. Every other project depends on them, so no spec
 * ever races the reset.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 4 : undefined,
  timeout: TIMEOUTS.test,
  expect: {
    timeout: TIMEOUTS.expect,
    toHaveScreenshot: {
      // Anti-aliasing differs by a hair between machines; a strict zero here
      // turns every CI run into a false failure.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  reporter: reporters,

  use: {
    baseURL: BASE_URL,
    actionTimeout: TIMEOUTS.action,
    navigationTimeout: TIMEOUTS.navigation,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    testIdAttribute: 'data-testid',
  },

  projects: [
    {
      name: 'setup-db',
      testDir: './setup',
      testMatch: /reset\.setup\.ts/,
    },
    {
      name: 'setup-auth',
      testDir: './setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['setup-db'],
    },

    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      // No browser is ever launched here: the specs only use `request`.
      dependencies: ['setup-db'],
    },

    {
      name: 'chromium',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      // Only the smoke set: a mobile viewport is a layout risk, not a logic
      // risk, so re-running the whole regression suite on it buys runtime
      // rather than coverage.
      grep: /@smoke/,
      use: { ...devices['Pixel 7'] },
    },

    {
      name: 'a11y',
      testMatch: /tests\/a11y\/.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'visual',
      testMatch: /tests\/visual\/.*\.spec\.ts/,
      dependencies: ['setup-db'],
      // Baselines are captured on one engine only. Cross-browser screenshot
      // baselines are a maintenance tax with almost no defect-finding return.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],

  /**
   * Runs the production build, not the dev server: dev-mode compilation delays
   * make the first navigation of each spec unpredictable, which shows up as
   * random timeouts rather than as the slow build it actually is.
   */
  webServer: {
    command: 'npm run start -w app',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !IS_CI,
    timeout: TIMEOUTS.webServer,
    cwd: '..',
    env: {
      E2E_TEST_MODE: '1',
      TEST_API_TOKEN: process.env.TEST_API_TOKEN ?? 'fretline-e2e-token',
      ...(process.env.SEED_BUGS ? { SEED_BUGS: process.env.SEED_BUGS } : {}),
      ...(process.env.SEED_BUGS ? { NEXT_PUBLIC_SEED_BUGS: process.env.SEED_BUGS } : {}),
    },
  },

  // Baselines are pinned to the platform: a screenshot taken on macOS will never
  // match one taken on Linux, and silently comparing them wastes an afternoon.
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
});

export { STORAGE_STATE_PATH };
