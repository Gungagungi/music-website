import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads the repository-root `.env` for the standalone scripts (migrate, seed).
 *
 * Next.js reads `.env` by itself, so the application never needs this — only the
 * scripts run outside the framework do. Missing file is not an error: CI and the
 * production container pass DATABASE_URL through the environment, and `.env` is
 * a local convenience that is deliberately not committed.
 */
// app/src/db/load-env.ts → repository root
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function loadEnv(): void {
  // `.env.local` first: loadEnvFile never overwrites a variable that is already
  // set, so whatever is read first wins — and a real environment variable, set by
  // CI or the container, wins over both.
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(join(repoRoot, file));
    } catch {
      // Absent or unreadable — the environment is expected to supply the values.
    }
  }
}
