import { closePool } from '@/db/client';
import { resetDatabase } from '@/db/seed';

/**
 * Restores the seeded state from the command line.
 *
 * Same code path as `POST /api/test/reset`, so a developer clearing their local
 * database exercises exactly what the suite exercises. Never point this at
 * production: it truncates every table.
 */

const started = Date.now();

resetDatabase()
  .then((summary) => {
    console.log(
      `[db] base réinitialisée en ${Date.now() - started} ms — ` +
        `${summary.products} produits, ${summary.users} utilisateurs, ` +
        `${summary.orders} commandes, ${summary.carts} paniers`,
    );
  })
  .catch((error: unknown) => {
    console.error('[db] échec de la réinitialisation :', error);
    process.exitCode = 1;
  })
  .finally(closePool);
