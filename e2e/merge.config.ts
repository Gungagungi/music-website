import { defineConfig } from '@playwright/test';

/**
 * Configuration used only by `playwright merge-reports`.
 *
 * Blob reports record the absolute path of `testDir` at the time they were
 * produced. Our CI deliberately runs some jobs on the runner host and others
 * inside the Playwright container, which check the repository out at two
 * different roots (`/home/runner/work/...` and `/__w/...`). `merge-reports`
 * sees two testDirs, cannot tell a legitimate multi-machine run apart from an
 * accidental mix of unrelated configs, and refuses to merge.
 *
 * Passing this file with `-c` names the canonical location explicitly, which
 * both unblocks the merge and keeps the file links in the HTML report pointing
 * at real paths.
 *
 * Reporters live here rather than on the command line because `-c` makes the
 * config the source of truth for them.
 */
export default defineConfig({
  testDir: './tests',
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['./reporters/summary-reporter.ts'],
  ],
});
