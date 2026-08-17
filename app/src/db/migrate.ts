import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { closePool, db, getPool } from '@/db/client';

/**
 * Runs the prelude, then the generated migrations.
 *
 * Used both by `npm run db:migrate` and by the container entrypoint. It calls the
 * migrator programmatically rather than shelling out to `drizzle-kit`, which is a
 * devDependency and has no business being in a production image.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', '..', 'drizzle');

export async function runMigrations(): Promise<void> {
  const prelude = await readFile(join(migrationsFolder, 'prelude.sql'), 'utf8');
  // Outside drizzle's journal on purpose: the prelude is idempotent and must be
  // in place *before* the first migration creates a generated column that calls
  // fretline_unaccent().
  await getPool().query(prelude);

  await migrate(db, { migrationsFolder });
}

/** True when this module was launched directly, false when imported. */
function runAsScript(): boolean {
  const invoked = process.argv[1];
  return Boolean(invoked && import.meta.url === pathToFileURL(invoked).href);
}

if (runAsScript()) {
  runMigrations()
    .then(() => console.log('[db] migrations appliquées'))
    .catch((error: unknown) => {
      console.error('[db] échec des migrations :', error);
      process.exitCode = 1;
    })
    .finally(closePool);
}
