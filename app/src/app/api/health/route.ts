import { ok } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness probe used by Playwright's `webServer` and by the k6 scripts. */
export async function GET() {
  const db = getDb();
  return ok({
    status: 'ok',
    version: '1.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    products: db.products.length,
    testMode: process.env.E2E_TEST_MODE === '1',
    seededBugs: process.env.SEED_BUGS === '1',
  });
}
