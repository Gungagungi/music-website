import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toProduct } from '@/db/mappers';
import { orderItems, products } from '@/db/schema';
import type { CategorySlug, Product } from '@/lib/types';

/**
 * What else to show on a product page.
 *
 * Two suggestions, and they answer different questions. "Accessoires
 * compatibles" is a *rule* — what goes with this kind of instrument — and is
 * therefore derived from the category, deterministically. "Souvent acheté avec"
 * is an *observation*, and is computed from the orders that actually contain the
 * product. Faking the second from the first would be the easy path and would
 * make the section a decoration that no data can ever contradict.
 */

/**
 * Which shelves an instrument's accessories live on.
 *
 * Written out rather than inferred from the category label: a bass takes bass
 * strings, and "cordes" as a whole would put light-gauge guitar strings under a
 * five-string bass. The catalogue has no compatibility field, so the rule lives
 * here, explicitly, where it can be read and argued with.
 */
const ACCESSORY_SHELVES: Record<CategorySlug, CategorySlug[]> = {
  'guitares-electriques': ['cordes', 'accessoires', 'amplis-guitare', 'pedales-effets'],
  'guitares-acoustiques': ['cordes', 'accessoires'],
  'guitares-classiques': ['cordes', 'accessoires'],
  'basses-electriques': ['cordes', 'accessoires', 'amplis-basse'],
  'amplis-guitare': ['accessoires', 'pedales-effets'],
  'amplis-basse': ['accessoires'],
  'pedales-effets': ['accessoires', 'amplis-guitare'],
  // An accessory suggests other accessories, never the instrument: someone
  // buying a strap is not shopping for a second guitar.
  cordes: ['accessoires'],
  accessoires: ['cordes'],
};

/**
 * Accessories that go with this product.
 *
 * Ordered by best-seller, then rating, then id. The id is not decoration: the
 * first two keys tie constantly across a catalogue of this size, and without a
 * total order the same page would show different accessories from one request
 * to the next — the catalogue sort's defect, in a smaller frame.
 */
export async function accessoriesFor(
  product: Pick<Product, 'id' | 'category'>,
  limit = 4,
  executor: DbOrTx = db,
): Promise<Product[]> {
  const shelves = ACCESSORY_SHELVES[product.category];
  if (shelves.length === 0) return [];

  const rows = await executor
    .select()
    .from(products)
    .where(and(inArray(products.category, shelves), ne(products.id, product.id)))
    .orderBy(desc(products.bestSeller), desc(products.rating), asc(products.id))
    .limit(limit);

  return rows.map(toProduct);
}

/**
 * Products bought in the same order as this one, most frequent first.
 *
 * Read from `order_items`, so the section says something true or says nothing.
 * An empty result renders no section at all: "souvent acheté avec" followed by
 * a list nobody ever bought together is worse than silence.
 *
 * Ties break on `id`, for the same reason as above — co-purchase counts are
 * small integers and tie constantly.
 */
export async function boughtTogetherWith(
  productId: string,
  limit = 4,
  executor: DbOrTx = db,
): Promise<Product[]> {
  const ordersWithProduct = executor
    .select({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(eq(orderItems.productId, productId));

  const rows = await executor
    .select({ productId: orderItems.productId, occurrences: count() })
    .from(orderItems)
    .where(
      and(
        sql`${orderItems.orderId} IN ${ordersWithProduct}`,
        ne(orderItems.productId, productId),
      ),
    )
    .groupBy(orderItems.productId)
    .orderBy(desc(count()), asc(orderItems.productId))
    .limit(limit);

  if (rows.length === 0) return [];

  const found = await executor
    .select()
    .from(products)
    .where(inArray(products.id, rows.map((row) => row.productId)));

  // Re-ordered in JavaScript: `IN` gives no ordering guarantee, and the ranking
  // is the whole point of the section.
  const byId = new Map(found.map((row) => [row.id, toProduct(row)]));
  return rows.flatMap((row) => {
    const product = byId.get(row.productId);
    return product ? [product] : [];
  });
}
