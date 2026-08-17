/**
 * Server startup hook. Next.js calls `register()` once per server process,
 * before the first request is served.
 *
 * Its only job here is to make a misconfigured deployment fail loudly and
 * immediately. The alternative — discovering at the first sign-in that
 * AUTH_SECRET was never set — means the site has already been serving sessions
 * signed with a key that is published in this repository.
 *
 * Migrations deliberately do *not* run here. They belong to the one-shot
 * `migrate` service in docker-compose.yml, which finishes before the app starts:
 * running them at boot would have every replica migrate concurrently the day
 * there is more than one.
 */
export async function register(): Promise<void> {
  // `register()` also runs on the edge runtime, where none of this applies.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { assertDeploymentConfig, deploymentWarnings } = await import('@/lib/deployment');

  for (const warning of deploymentWarnings()) {
    console.warn(`[fretline] ATTENTION — ${warning}`);
  }

  try {
    assertDeploymentConfig();
  } catch (error) {
    console.error(`[fretline] configuration refusée : ${(error as Error).message}`);
    // An explicit exit rather than a rethrow: a thrown error here is reported
    // but leaves the server listening, which is exactly the outcome this guard
    // exists to prevent.
    //
    // Note that the server prints "Ready" just before this runs. Nothing is
    // signed in that window: `authSecret()` throws on every call in production,
    // so a request arriving between the two would fail rather than mint a token
    // with the published demo key. The exit is there to make the mistake
    // impossible to miss, not to close a hole.
    process.exit(1);
  }
}
