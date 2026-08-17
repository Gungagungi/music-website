import { runCommand } from '@/db/cli/run';
import { resetDatabase } from '@/db/seed';

/**
 * Restores the seeded state from the command line.
 *
 * Same code path as `POST /api/test/reset`, so a developer clearing their local
 * database exercises exactly what the suite exercises. Never point this at
 * production: it truncates every table.
 */
runCommand('réinitialisation', async () => {
  const started = Date.now();
  const summary = await resetDatabase();

  console.log(
    `[db] base réinitialisée en ${Date.now() - started} ms — ` +
      `${summary.products} produits, ${summary.users} utilisateurs, ` +
      `${summary.orders} commandes, ${summary.carts} paniers`,
  );
});
