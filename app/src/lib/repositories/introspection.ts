import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { carts, orders, products, reviews, users } from '@/db/schema';

/**
 * Server state a spec cannot observe through the UI. Backs `GET /api/test/state`.
 */

export interface ServerState {
  products: number;
  users: number;
  carts: number;
  orders: number;
  reviews: number;
  counters: { order: number; user: number };
}

/**
 * Reads a sequence as the in-memory counter it replaces.
 *
 * The old counters held "how many have been handed out": 3 after a reset for
 * users, 0 for orders. A sequence instead holds the value it last produced, and
 * `is_called` distinguishes "never used" from "produced its start value" — the
 * two states that would otherwise both read as 1 on `order_ref_seq` and make the
 * first order look like it had already been placed.
 */
const counterFrom = (sequence: string) =>
  sql<number>`(SELECT (CASE WHEN is_called THEN last_value ELSE last_value - 1 END)::int FROM ${sql.identifier(sequence)})`;

export async function readServerState(): Promise<ServerState> {
  const [row] = await db
    .select({
      products: sql<number>`(SELECT count(*)::int FROM ${products})`,
      users: sql<number>`(SELECT count(*)::int FROM ${users})`,
      carts: sql<number>`(SELECT count(*)::int FROM ${carts})`,
      orders: sql<number>`(SELECT count(*)::int FROM ${orders})`,
      reviews: sql<number>`(SELECT count(*)::int FROM ${reviews})`,
      order: counterFrom('order_ref_seq'),
      user: counterFrom('user_id_seq'),
    })
    .from(sql`(SELECT 1) AS unite`);

  return {
    products: row?.products ?? 0,
    users: row?.users ?? 0,
    carts: row?.carts ?? 0,
    orders: row?.orders ?? 0,
    reviews: row?.reviews ?? 0,
    counters: { order: row?.order ?? 0, user: row?.user ?? 0 },
  };
}
