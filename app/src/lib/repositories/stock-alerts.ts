import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { products, stockAlerts } from '@/db/schema';
import type { StockAlert } from '@/lib/types';

/** Reads and writes on `stock_alerts` — "tell me when this is back". */

interface AlertRow {
  id: string;
  productId: string;
  userId: string;
  createdAt: Date;
  notifiedAt: Date | null;
}

function toAlert(row: AlertRow & { slug?: string; name?: string; brand?: string }): StockAlert {
  return {
    id: row.id,
    productId: row.productId,
    slug: row.slug ?? '',
    name: row.name ?? '',
    brand: row.brand ?? '',
    createdAt: row.createdAt.toISOString(),
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
  };
}

/**
 * Subscribes a customer to a product's restock.
 *
 * Idempotent by construction: `ON CONFLICT DO NOTHING` on the unique index, then
 * the existing row is read back. Subscribing twice is a double-click, not a
 * request to be told twice, and answering 409 to it would make the button feel
 * broken for no gain.
 */
export async function createAlert(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<StockAlert> {
  await executor.insert(stockAlerts).values({ productId, userId }).onConflictDoNothing();

  const [row] = await executor
    .select()
    .from(stockAlerts)
    .where(and(eq(stockAlerts.productId, productId), eq(stockAlerts.userId, userId)))
    .limit(1);

  return toAlert(row!);
}

export async function deleteAlert(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const deleted = await executor
    .delete(stockAlerts)
    .where(and(eq(stockAlerts.productId, productId), eq(stockAlerts.userId, userId)))
    .returning({ id: stockAlerts.id });

  return deleted.length > 0;
}

export async function hasAlert(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const [row] = await executor
    .select({ one: sql`1` })
    .from(stockAlerts)
    .where(and(eq(stockAlerts.productId, productId), eq(stockAlerts.userId, userId)))
    .limit(1);

  return Boolean(row);
}

/** A customer's own alerts, newest first, joined to what they are about. */
export async function alertsForUser(userId: string, executor: DbOrTx = db): Promise<StockAlert[]> {
  const rows = await executor
    .select({
      id: stockAlerts.id,
      productId: stockAlerts.productId,
      userId: stockAlerts.userId,
      createdAt: stockAlerts.createdAt,
      notifiedAt: stockAlerts.notifiedAt,
      slug: products.slug,
      name: products.name,
      brand: products.brand,
    })
    .from(stockAlerts)
    .innerJoin(products, eq(products.id, stockAlerts.productId))
    .where(eq(stockAlerts.userId, userId))
    .orderBy(sql`${stockAlerts.createdAt} desc, ${stockAlerts.id} desc`);

  return rows.map(toAlert);
}

/**
 * Marks every pending alert whose product is back on the shelf.
 *
 * This is the sweep a mailer would run; sending is out of scope here, and
 * deliberately so — a fictional shop with a real SMTP dependency would make the
 * suite need a mail server. What is modelled is the part that has rules: which
 * alerts fire, and that each fires **once**.
 *
 * `notified_at` is set rather than the row deleted. Deleting would let a second
 * restock re-notify someone who asked once, months earlier, and never asked
 * again — the row is the record that we already told them.
 *
 * One statement, so a concurrent restock cannot double-notify: the WHERE clause
 * and the write see the same snapshot.
 */
export async function notifyRestocked(executor: DbOrTx = db): Promise<StockAlert[]> {
  const pending = executor
    .select({ id: stockAlerts.id })
    .from(stockAlerts)
    .innerJoin(products, eq(products.id, stockAlerts.productId))
    .where(and(isNull(stockAlerts.notifiedAt), gt(products.stock, 0)));

  const notified = await executor
    .update(stockAlerts)
    .set({ notifiedAt: new Date() })
    .where(sql`${stockAlerts.id} IN ${pending}`)
    .returning();

  return notified.map((row) => toAlert(row));
}
