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
 * La profondeur de sortie est contrainte : `migrate.ts` cherche ses migrations à
 * `../../drizzle` par rapport à son propre fichier. `dist/db/migrate.mjs` tombe
 * donc sur `<app>/drizzle`, exactement comme `src/db/migrate.ts` en
 * développement. Déplacer `outdir` d'un cran casserait les migrations dans
 * l'image, et nulle part ailleurs.
 *
 * Les points d'entrée sont ceux de `src/db/cli/`, qui ne contiennent que
 * l'invocation. Les modules qui font le travail n'ont aucun effet de bord à
 * l'import — voir cli/run.ts pour ce qui arrive quand ce n'est pas le cas.
 *
 * Usage: node scripts/build-db-cli.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// `reset` est volontairement absent : il tronque toutes les tables. Il n'a
// aucune raison d'exister dans une image de production, où il ne serait qu'une
// arme chargée à portée d'un `docker compose run`. C'est une commande de
// développement, lancée par `npm run db:reset` via tsx.
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

console.log(`[build] commandes de base compilées : ${COMMANDS.join(', ')}`);
