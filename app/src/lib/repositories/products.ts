import { eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toProduct } from '@/db/mappers';
import { products } from '@/db/schema';
import type { Product } from '@/lib/types';

/** Reads and writes on `products`. The catalogue query itself lands in lot 2. */

export async function findProductById(
  id: string,
  executor: DbOrTx = db,
): Promise<Product | undefined> {
  const [row] = await executor.select().from(products).where(eq(products.id, id)).limit(1);
  return row ? toProduct(row) : undefined;
}

export async function findProductBySlug(
  slug: string,
  executor: DbOrTx = db,
): Promise<Product | undefined> {
  const [row] = await executor.select().from(products).where(eq(products.slug, slug)).limit(1);
  return row ? toProduct(row) : undefined;
}

export async function findProductBySku(
  sku: string,
  executor: DbOrTx = db,
): Promise<Product | undefined> {
  const [row] = await executor
    .select()
    .from(products)
    .where(sql`lower(${products.sku}) = lower(${sku})`)
    .limit(1);
  return row ? toProduct(row) : undefined;
}

/**
 * Forces a stock level. Used by the seed endpoint to arrange a precondition —
 * "one unit left" — that would otherwise take a dozen checkouts to reach.
 *
 * Returns `undefined` for an unknown slug so the caller can answer 404 rather
 * than silently succeeding on nothing.
 */
export async function setProductStock(
  slug: string,
  quantity: number,
  executor: DbOrTx = db,
): Promise<Product | undefined> {
  const [row] = await executor
    .update(products)
    .set({ stock: quantity })
    .where(eq(products.slug, slug))
    .returning();
  return row ? toProduct(row) : undefined;
}

export async function countProducts(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(products);
  return row?.count ?? 0;
}
