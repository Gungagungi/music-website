import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { cartItems, carts } from '@/db/schema';
import { roundCents } from '@/lib/money';
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
}

export async function setCartItemQuantity(itemId: string, quantity: number, executor: DbOrTx = db) {
  await executor.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));
}

export async function deleteCartItem(itemId: string, executor: DbOrTx = db): Promise<boolean> {
  const deleted = await executor
    .delete(cartItems)
    .where(eq(cartItems.id, itemId))
    .returning({ id: cartItems.id });
  return deleted.length > 0;
}

export async function deleteCartItems(cartId: string, executor: DbOrTx = db) {
  await executor.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function countCarts(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(carts);
  return row?.count ?? 0;
}
