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
 * Ce module doit rester exempt d'API Node.js : Next le compile aussi pour le
 * runtime edge et l'analyse statiquement, donc un `process.exit` écrit ici est
 * signalé même sous un garde d'exécution. Le travail est dans
 * `instrumentation-node.ts`, atteint par un `import()` conditionnel.
 */
export async function register(): Promise<void> {
  // `register()` also runs on the edge runtime, where none of this applies.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { verifierConfiguration } = await import('@/instrumentation-node');
  await verifierConfiguration();
}
