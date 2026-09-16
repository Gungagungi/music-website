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
 *
 * This module must stay free of Node.js APIs: Next also compiles it for the edge
 * runtime and analyses it statically, so a `process.exit` written here is
 * flagged even behind a run-time guard. The work lives in
 * `instrumentation-node.ts`, reached through a conditional `import()`.
 */
export async function register(): Promise<void> {
  // `register()` also runs on the edge runtime, where none of this applies.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { verifierConfiguration } = await import('@/instrumentation-node');
  await verifierConfiguration();
}
