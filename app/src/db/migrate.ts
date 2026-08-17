import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, getPool } from '@/db/client';

/**
 * Runs the prelude, then the generated migrations.
 *
 * Used both by `npm run db:migrate` and by the container entrypoint. It calls the
 * migrator programmatically rather than shelling out to `drizzle-kit`, which is a
 * devDependency and has no business being in a production image.
 */

/**
 * Located two levels up from this file: `src/db/` → `app/drizzle` in
 * development, and `dist/db/` → `app/drizzle` in the production image, where
 * this module is bundled into `dist/db/migrate.mjs`. The two only agree because
 * scripts/build-db-cli.mjs keeps the output at the same depth as the source —
 * a constraint documented there as well, because breaking it from either side
 * produces the same puzzling ENOENT at container start.
 */
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', '..', 'drizzle');

export async function runMigrations(): Promise<void> {
  const prelude = await readFile(join(migrationsFolder, 'prelude.sql'), 'utf8').catch(() => {
    throw new Error(
      `Migrations introuvables dans ${migrationsFolder}. En développement, elles sont ` +
        'dans app/drizzle ; dans l’image, elles y sont copiées par le Dockerfile.',
    );
  });
  // Outside drizzle's journal on purpose: the prelude is idempotent and must be
  // in place *before* the first migration creates a generated column that calls
  // fretline_unaccent().
  await getPool().query(prelude);

  await migrate(db, { migrationsFolder });
}
