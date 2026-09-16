/**
 * Mutation testing on the monetary arithmetic.
 *
 * A green suite says that no test fails; it does not say that a test would fail
 * if the code went wrong. Stryker asks the question directly: it replaces `>=`
 * with `>`, `Math.round` with `Math.floor`, a `+` with a `-`, and counts the
 * mutants the suite lets through. On prices, a surviving mutant is a cent nobody
 * will ever claim.
 *
 * The scope is deliberately tiny. This is not coverage of the repository: it is
 * `money.ts`, and the pure functions of `cart.ts` — the ones that decide an
 * amount. The rest of `cart.ts` talks to the database, does not lend itself to
 * a fast unit suite, and stays covered by the API suite.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mts' },
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },

  // The line ranges follow the "Pure pricing" section of `cart.ts`. If pure
  // code is moved or extended there without updating this range, the score
  // drops and CI says so — the oversight reports itself instead of settling in.
  mutate: ['src/lib/money.ts', 'src/lib/cart.ts:44-48', 'src/lib/cart.ts:72-149'],

  // 100 % or nothing: on this scope, a surviving mutant points at a rounding
  // rule nothing holds. The threshold is sustainable because the scope is
  // small — that is the price of keeping it a signal.
  thresholds: { high: 100, low: 100, break: 100 },
  timeoutMS: 20000,
};

export default config;
