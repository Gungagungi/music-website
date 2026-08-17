import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { cartItems, carts } from '@/db/schema';
import { roundCents } from '@/lib/money';
import {
  ACCOUNT_CART_RETENTION_DAYS,
  EMPTY_CART_RETENTION_HOURS,
  GUEST_CART_RETENTION_DAYS,
  PURGE_BATCH_SIZE,
} from '@/lib/retention';
import type { CartItem } from '@/lib/types';

/**
 * Reads and writes on `carts` / `cart_items`.
 *
 * `line_total` and the cart totals are **not** columns: they are derived from the
 * unit price and the quantity, and storing them would create a second version of
 * the truth that nothing keeps in step. They are computed on the way out, by the
 * same pure functions the checkout uses.
 */

export interface CartRow {
  id: string;
  userId: string | null;
  couponCode: string | null;
  updatedAt: Date;
}

export async function insertCart(
  userId: string | null,
  executor: DbOrTx = db,
): Promise<CartRow> {
  const [row] = await executor.insert(carts).values({ userId, updatedAt: new Date() }).returning();
  return row!;
}

export async function findCart(id: string, executor: DbOrTx = db): Promise<CartRow | undefined> {
  // The id comes from a cookie the client can edit; `::text` keeps a malformed
  // value a miss instead of a uuid syntax error bubbling up as a 500.
  const [row] = await executor
    .select()
    .from(carts)
    .where(sql`${carts.id}::text = ${id}`)
    .limit(1);
  return row;
}

export async function findCartItems(cartId: string, executor: DbOrTx = db): Promise<CartItem[]> {
  const rows = await executor
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.position));

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    color: row.color,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    lineTotal: roundCents(row.unitPrice * row.quantity),
  }));
}

export async function claimCart(cartId: string, userId: string, executor: DbOrTx = db) {
  // Only fills an empty owner: a guest cart adopted at sign-in stays with the
  // account it was attached to, it does not change hands.
  await executor
    .update(carts)
    .set({ userId })
    .where(and(eq(carts.id, cartId), sql`${carts.userId} IS NULL`));
}

export async function setCartCoupon(
  cartId: string,
  couponCode: string | null,
  executor: DbOrTx = db,
) {
  await executor
    .update(carts)
    .set({ couponCode, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}

/**
 * Stamps the cart as active.
 *
 * Every mutation goes through this, including the ones that only touch
 * `cart_items`. `updated_at` is what the retention policy reads to decide the
 * cart is abandoned, so a line change that did not move it would let a cart
 * somebody has been filling all month look untouched since the day it was
 * created — and get deleted.
 */
async function touchCart(cartId: string, executor: DbOrTx) {
  await executor.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function upsertCartItem(
  cartId: string,
  line: Omit<CartItem, 'id' | 'lineTotal'>,
  executor: DbOrTx = db,
) {
  const [{ next } = { next: 0 }] = await executor
    .select({ next: sql<number>`coalesce(max(${cartItems.position}), -1) + 1` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  await executor
    .insert(cartItems)
    .values({ cartId, ...line, position: next })
    // Matches `cart_items_unique_line`, so re-adding the same product in the
    // same colour accumulates on one line instead of splitting the cart.
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId, cartItems.color],
      set: { quantity: line.quantity },
    });

  await touchCart(cartId, executor);
}

export async function setCartItemQuantity(itemId: string, quantity: number, executor: DbOrTx = db) {
  const [row] = await executor
    .update(cartItems)
    .set({ quantity })
    .where(eq(cartItems.id, itemId))
    .returning({ cartId: cartItems.cartId });
  if (row) await touchCart(row.cartId, executor);
}

export async function deleteCartItem(itemId: string, executor: DbOrTx = db): Promise<boolean> {
  const [row] = await executor
    .delete(cartItems)
    .where(eq(cartItems.id, itemId))
    .returning({ cartId: cartItems.cartId });
  if (row) await touchCart(row.cartId, executor);
  return Boolean(row);
}

export async function deleteCartItems(cartId: string, executor: DbOrTx = db) {
  await executor.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await touchCart(cartId, executor);
}

export async function countCarts(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(carts);
  return row?.count ?? 0;
}

/**
 * The nil UUID, used as the identity of a cart that was never stored.
 *
 * `resolveCart` hands back an ephemeral empty cart to visitors who have none
 * yet, rather than writing a row for every request that so much as looks at the
 * cart. Giving it a real — but unassignable — uuid means every query it reaches
 * stays type-correct and simply matches nothing: reads come back empty, writes
 * affect zero rows. The alternative, an empty string, turns each of those into a
 * uuid syntax error, and a sentinel that has to be special-cased at ten call
 * sites gets forgotten at the eleventh.
 */
export const EPHEMERAL_CART_ID = '00000000-0000-0000-0000-000000000000';

export interface PurgeSummary {
  emptyCarts: number;
  guestCarts: number;
  dormantAccountCarts: number;
}

/** Deletes in bounded batches until the statement stops finding anything. */
async function purgeBatched(where: SQL, executor: DbOrTx): Promise<number> {
  let total = 0;
  for (;;) {
    const deleted = await executor
      .delete(carts)
      .where(
        inArray(
          carts.id,
          executor.select({ id: carts.id }).from(carts).where(where).limit(PURGE_BATCH_SIZE),
        ),
      )
      .returning({ id: carts.id });

    total += deleted.length;
    if (deleted.length < PURGE_BATCH_SIZE) return total;
  }
}

/**
 * Applies the retention policy described in lib/retention.ts.
 *
 * `cart_items` follows through `ON DELETE CASCADE`. Orders are untouched by
 * design: `order_items` holds its own snapshot of what was bought and has no
 * foreign key back to the cart, so deleting the cart a sale came from cannot
 * damage the sale.
 */
export async function purgeStaleCarts(executor: DbOrTx = db): Promise<PurgeSummary> {
  const hasItems = sql`EXISTS (SELECT 1 FROM ${cartItems} WHERE ${cartItems.cartId} = ${carts.id})`;
  const olderThan = (interval: SQL) => sql`${carts.updatedAt} < now() - ${interval}`;

  const emptyCarts = await purgeBatched(
    sql`${carts.userId} IS NULL AND NOT ${hasItems} AND ${olderThan(sql`make_interval(hours => ${EMPTY_CART_RETENTION_HOURS})`)}`,
    executor,
  );

  const guestCarts = await purgeBatched(
    sql`${carts.userId} IS NULL AND ${olderThan(sql`make_interval(days => ${GUEST_CART_RETENTION_DAYS})`)}`,
    executor,
  );

  // Signed-in carts are exempt from the two rules above — see retention.ts. This
  // last sweep is about dormancy, and is measured in a year rather than days.
  const dormantAccountCarts = await purgeBatched(
    sql`${carts.userId} IS NOT NULL AND ${olderThan(sql`make_interval(days => ${ACCOUNT_CART_RETENTION_DAYS})`)}`,
    executor,
  );

  return { emptyCarts, guestCarts, dormantAccountCarts };
}
