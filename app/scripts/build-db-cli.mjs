/**
 * Bundles the database commands for the production image.
 *
 * `db:migrate`, `db:seed` and `db:purge` run through `tsx` in development, which
 * is a devDependency and has no business in a runtime image. Rather than ship
 * `src/` and a TypeScript loader, each entry point is bundled once at build time
 * into a plain ESM file.
 *
 * `pg` is left external because Next's standalone tracing already puts it in
 * `standalone/node_modules`. `drizzle-orm`, by contrast, is *not* traced there —
 * Next bundles it into its own server chunks — so it has to be bundled in here
 * too, or the migrator would start and fail on a missing module.
 *
 * The output depth is constrained: `migrate.ts` looks for its migrations at
 * `../../drizzle` relative to its own file. `dist/db/migrate.mjs` therefore
 * lands on `<app>/drizzle`, exactly like `src/db/migrate.ts` in development.
 * Moving `outdir` by one level would break migrations in the image, and nowhere
 * else.
 *
 * The entry points are those of `src/db/cli/`, which contain only the
 * invocation. The modules that do the work have no side effect on import — see
 * cli/run.ts for what happens when that is not the case.
 *
 * Usage: node scripts/build-db-cli.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// `reset` is deliberately absent: it truncates every table. It has no reason to
// exist in a production image, where it would only be a loaded weapon within
// reach of a `docker compose run`. It is a development command, run by
// `npm run db:reset` through tsx.
const COMMANDS = ['bootstrap', 'migrate', 'seed', 'purge'];

await build({
  entryPoints: COMMANDS.map((name) => join(appRoot, 'src', 'db', 'cli', `${name}.ts`)),
  outdir: join(appRoot, 'dist', 'db'),
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Resolves the `@/*` alias from the workspace tsconfig, so the bundled code
  // and the source agree on what `@/db/client` means.
  tsconfig: join(appRoot, 'tsconfig.json'),
  external: ['pg', 'pg-native'],
  logLevel: 'info',
});

console.log(`[build] database commands compiled: ${COMMANDS.join(', ')}`);
