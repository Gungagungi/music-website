import { closePool } from '@/db/client';

/**
 * Command-line entry points for the database commands.
 *
 * They live in their own directory, apart from the modules that do the work, and
 * that separation is not tidiness. It used to be that `migrate.ts` and `seed.ts`
 * each ended with an `if (launchedDirectly()) { … }` block guarded by comparing
 * `import.meta.url` to `process.argv[1]`. That check is correct for a file Node
 * loads as a module, and wrong for a bundle: esbuild collapses every module into
 * one file, so all of them end up sharing the bundle's own `import.meta.url` —
 * and every guard turns true at once.
 *
 * The failure was spectacular in the way that matters. Running the production
 * `bootstrap` command started the migrations three times over, in parallel,
 * against the same pool: PostgreSQL answered `tuple concurrently updated`, and
 * each copy closed the pool from under the others on its way out. On a first
 * deployment that is a container that will not start and an error message
 * pointing nowhere near the cause.
 *
 * A module that does nothing when imported cannot have that problem, whatever
 * the bundler decides to do with it.
 */
export function runCommand(name: string, action: () => Promise<void>): void {
  action()
    .catch((error: unknown) => {
      console.error(`[db] échec — ${name} :`, error);
      process.exitCode = 1;
    })
    .finally(closePool);
}
