/**
 * Node.js body of the startup hook, isolated in its own module.
 *
 * The split is not cosmetic. Next compiles `instrumentation.ts` for both
 * runtimes, and its analysis is **static**: it sees `process.exit` in the
 * module's text and warns that it does not exist on the edge runtime, even
 * though the `NEXT_RUNTIME !== 'nodejs'` guard prevents it from running. A
 * static check cannot read a run-time test. Moving the call behind a
 * conditional dynamic `import()` is what actually takes it out of the edge
 * graph — it is the form Next recommends, and the only one that makes the
 * warning go away without masking it.
 *
 * In practice: do not reintroduce Node.js APIs into `instrumentation.ts`. They
 * live here.
 */
export async function verifierConfiguration(): Promise<void> {
  const { assertDeploymentConfig, deploymentWarnings } = await import('@/lib/deployment');

  for (const warning of deploymentWarnings()) {
    console.warn(`[fretline] WARNING — ${warning}`);
  }

  try {
    assertDeploymentConfig();
  } catch (error) {
    console.error(`[fretline] configuration rejected: ${(error as Error).message}`);
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
