/**
 * Tells a real deployment apart from a local or CI run, and refuses to start a
 * real one that is misconfigured.
 *
 * The distinction cannot be `NODE_ENV === 'production'` alone. Playwright's
 * `webServer` runs `npm run start -w app`, which *is* production mode — a guard
 * keyed on NODE_ENV would either take the whole suite down or, worse, be relaxed
 * until it protects nothing. What separates the two is that the suite sets
 * `E2E_TEST_MODE=1` and the production compose never does.
 *
 * The guard is fail-closed: an unrecognised environment is treated as
 * production. Forgetting to set a marker then costs a startup error, not a
 * publicly forgeable session cookie.
 */

/** The checked-in secret. Fine for a demo store; refused on a real deployment. */
export const DEMO_AUTH_SECRET = 'fretline-demo-secret-do-not-use-in-production';

export function isTestMode(): boolean {
  return process.env.E2E_TEST_MODE === '1';
}

export function isProductionDeployment(): boolean {
  return process.env.NODE_ENV === 'production' && !isTestMode();
}

/**
 * The signing key, resolved on first use.
 *
 * Lazy on purpose: throwing while a module is being imported turns a
 * configuration mistake into a 500 on whichever request happened to load the
 * route first. `assertDeploymentConfig()` calls this at startup so the container
 * dies immediately instead.
 */
export function authSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();

  if (configured && configured !== DEMO_AUTH_SECRET) return configured;

  if (isProductionDeployment()) {
    throw new Error(
      configured
        ? "AUTH_SECRET est la valeur de démonstration, qui est publique : n'importe qui " +
          'pourrait forger une session pour n\'importe quel compte. Générez-en une : ' +
          'openssl rand -base64 48'
        : 'AUTH_SECRET est absent. Générez-en un : openssl rand -base64 48',
    );
  }

  return DEMO_AUTH_SECRET;
}

/**
 * Startup checks. Called from `instrumentation.ts`, once per server boot.
 *
 * Returns the warnings to print rather than printing them, so the rule and the
 * reporting stay testable apart.
 */
export function deploymentWarnings(): string[] {
  const warnings: string[] = [];

  if (isTestMode()) {
    warnings.push(
      'E2E_TEST_MODE=1 : /api/test/{reset,seed,state} sont ouverts. Ces endpoints ' +
        'effacent et réécrivent la base. Cette variable ne doit jamais être définie ' +
        'sur un déploiement réel.',
    );
  }

  if (process.env.SEED_BUGS === '1') {
    warnings.push('SEED_BUGS=1 : les trois défauts délibérés sont actifs.');
  }

  return warnings;
}

/** Throws if the process is a production deployment that cannot safely serve. */
export function assertDeploymentConfig(): void {
  authSecret();
}
