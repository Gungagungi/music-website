import { ok } from '@/lib/api';
import { countProducts } from '@/lib/repositories/products';

export const dynamic = 'force-dynamic';

/** Liveness probe used by Playwright's `webServer` and by the k6 scripts. */
export async function GET() {
  const products = await countProducts();
  return ok({
    status: 'ok',
    version: '1.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    products,
    testMode: process.env.E2E_TEST_MODE === '1',
    seededBugs: process.env.SEED_BUGS === '1',
  });
}
