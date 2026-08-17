import { runCommand } from '@/db/cli/run';
import { seedDatabase } from '@/db/seed';

// Unconditional and idempotent. `bootstrap` is the one to use on a deployment:
// it only seeds a database that has never been loaded.
runCommand('seed', async () => {
  await seedDatabase();
  console.log('[db] graines insérées');
});
