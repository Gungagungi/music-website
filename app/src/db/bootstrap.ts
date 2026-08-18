import { runMigrations } from '@/db/migrate';
import { isDatabaseEmpty, seedDatabase } from '@/db/seed';

/**
 * Brings a database up to date, then loads the catalogue if it has never been
 * loaded. This is what the one-shot `migrate` service in docker-compose.yml runs
 * before the application container is allowed to start.
 *
 * The seed is conditional, unlike `db:seed`, which is unconditional and
 * idempotent. Both are safe to re-run, but they are not the same promise: on a
 * live store, re-running the seed would resurrect every product an operator had
 * deleted, at every restart, and nobody would connect the two events. Seeding
 * only an empty database keeps a fresh volume working out of the box without
 * ever writing over decisions made since.
 *
 * `POST /api/test/reset` is never part of this path — it is not reachable on a
 * deployment, by design (see lib/deployment.ts).
 */
export async function bootstrap(): Promise<void> {
  await runMigrations();
  console.log('[db] migrations appliquées');

  if (await isDatabaseEmpty()) {
    await seedDatabase();
    console.log('[db] base vide : graines insérées');
    return;
  }

  console.log('[db] base déjà peuplée : seed ignoré');
}
