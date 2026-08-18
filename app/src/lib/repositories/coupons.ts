import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toCoupon } from '@/db/mappers';
import { coupons } from '@/db/schema';
import type { Coupon } from '@/lib/types';

/** Reads on `coupons`. */

/**
 * Looks a coupon up the way a customer types it: trimmed, any case.
 *
 * The stored code is upper-case by constraint, so folding one side would be
 * enough — both sides are folded anyway so the lookup cannot start disagreeing
 * with the constraint if the seed ever changes.
 */
export async function findCoupon(code: string, executor: DbOrTx = db): Promise<Coupon | undefined> {
  const [row] = await executor
    .select()
    .from(coupons)
    .where(sql`upper(${coupons.code}) = upper(${code.trim()})`)
    .limit(1);
  return row ? toCoupon(row) : undefined;
}
