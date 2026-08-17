import { runCommand } from '@/db/cli/run';
import { runMigrations } from '@/db/migrate';

runCommand('migrations', async () => {
  await runMigrations();
  console.log('[db] migrations appliquées');
});
