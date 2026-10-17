import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toProduct } from '@/db/mappers';
import { products, wishlistItems } from '@/db/schema';
import type { Product } from '@/lib/types';

/** Reads and writes on `wishlist_items`. */

/**
 * Saves a product. Idempotent, like subscribing to a restock: clicking a heart
 * twice is a double-click, not a request for two copies of the same wish.
 */
export async function addToWishlist(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<void> {
  await executor.insert(wishlistItems).values({ productId, userId }).onConflictDoNothing();
}

export async function removeFromWishlist(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const deleted = await executor
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.productId, productId), eq(wishlistItems.userId, userId)))
    .returning({ id: wishlistItems.id });

  return deleted.length > 0;
}

export async function isWishlisted(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const [row] = await executor
    .select({ one: sql`1` })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.productId, productId), eq(wishlistItems.userId, userId)))
    .limit(1);

  return Boolean(row);
}

/**
 * The customer's saved products, newest first.
 *
 * Joined to `products` rather than snapshotted at save time — the opposite
 * choice from an order line, and deliberately so. An order is a record of what
 * was bought at a price; a wish list is a pointer to what is on sale *now*, so
 * a price cut or a restock has to show through. That is most of its value.
 */
export async function wishlistFor(userId: string, executor: DbOrTx = db): Promise<Product[]> {
  const rows = await executor
    .select({ product: products })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt), asc(wishlistItems.id));

  return rows.map((row) => toProduct(row.product));
}
