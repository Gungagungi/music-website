import { and, asc, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toReview } from '@/db/mappers';
import { orderItems, orders, products, reviews } from '@/db/schema';
import type { RatingHistogram, Review, ReviewPage, ReviewQuery, ReviewSortKey } from '@/lib/types';

/** Reads and writes on `reviews`. */

export const DEFAULT_REVIEW_PAGE_SIZE = 5;
export const MAX_REVIEW_PAGE_SIZE = 50;

/**
 * Ordering clauses, each one closed by `id`.
 *
 * Without that tiebreaker, two reviews sharing a rating — the common case, on
 * five possible values — have no defined relative order, and PostgreSQL is free
 * to return them differently from one page to the next. A row would then appear
 * on two pages, or on none. Same defect as the catalogue sort, same fix.
 */
const ORDER_BY = {
  recents: [desc(reviews.createdAt), desc(reviews.id)],
  anciens: [asc(reviews.createdAt), asc(reviews.id)],
  'note-desc': [desc(reviews.rating), desc(reviews.createdAt), desc(reviews.id)],
  'note-asc': [asc(reviews.rating), desc(reviews.createdAt), desc(reviews.id)],
} as const satisfies Record<ReviewSortKey, unknown>;

const EMPTY_HISTOGRAM: RatingHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

/**
 * One page of a product's stored reviews, plus the two figures the filter UI
 * needs to stay usable.
 *
 * `histogram` and `storedCount` are deliberately computed *outside* the rating
 * filter: they are what the reader clicks on to filter, so recomputing them
 * under the active filter would collapse the histogram to a single bar and
 * strand anyone who picked a level with no reviews.
 */
export async function reviewPage(
  productId: string,
  query: ReviewQuery = {},
  executor: DbOrTx = db,
): Promise<ReviewPage> {
  const sort: ReviewSortKey = query.sort ?? 'recents';
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_REVIEW_PAGE_SIZE, 1), MAX_REVIEW_PAGE_SIZE);
  const page = Math.max(query.page ?? 1, 1);

  const filter =
    query.rating === undefined
      ? eq(reviews.productId, productId)
      : and(eq(reviews.productId, productId), eq(reviews.rating, query.rating));

  const [rows, [totalRow], histogram] = await Promise.all([
    executor
      .select()
      .from(reviews)
      .where(filter)
      .orderBy(...ORDER_BY[sort])
      .limit(limit)
      .offset((page - 1) * limit),
    executor.select({ value: count() }).from(reviews).where(filter),
    ratingHistogram(productId, executor),
  ]);

  const total = totalRow?.value ?? 0;
  const storedCount = Object.values(histogram).reduce((sum, value) => sum + value, 0);

  return {
    items: rows.map(toReview),
    page,
    limit,
    total,
    // A product with no review still has one (empty) page; the pagination
    // control and the API contract both assume `totalPages >= 1`.
    totalPages: Math.max(Math.ceil(total / limit), 1),
    histogram,
    storedCount,
  };
}

/**
 * Count of stored reviews per star level.
 *
 * Grouped in SQL, then folded onto a five-entry object: the query only returns
 * the levels that actually occur, and a bar chart missing its empty bars would
 * be unreadable.
 */
export async function ratingHistogram(
  productId: string,
  executor: DbOrTx = db,
): Promise<RatingHistogram> {
  const rows = await executor
    .select({ rating: reviews.rating, value: count() })
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .groupBy(reviews.rating);

  const histogram: RatingHistogram = { ...EMPTY_HISTOGRAM };
  for (const row of rows) {
    if (row.rating >= 1 && row.rating <= 5) {
      histogram[row.rating as keyof RatingHistogram] = row.value;
    }
  }
  return histogram;
}

export async function reviewsForProduct(
  productId: string,
  executor: DbOrTx = db,
): Promise<Review[]> {
  const rows = await executor
    .select()
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .orderBy(...ORDER_BY.recents);
  return rows.map(toReview);
}

export async function hasReviewed(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const [row] = await executor
    .select({ one: sql`1` })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Has this customer already ordered this product?
 *
 * Any order status counts, cancellations included: the badge says the reviewer
 * held the instrument, not that the sale stuck. Reading `order_items` rather
 * than a flag on the account is what keeps the claim true — it is the same row
 * that ships the guitar.
 */
export async function hasPurchased(
  productId: string,
  userId: string,
  executor: DbOrTx = db,
): Promise<boolean> {
  const [row] = await executor
    .select({ one: sql`1` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.productId, productId), eq(orders.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export interface NewReview {
  id: string;
  productId: string;
  userId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
}

/**
 * Publishes a review and moves the product's aggregates with it.
 *
 * Both happen in one transaction: a review that landed without its rating being
 * counted would be invisible to every sort and facet, and nothing would ever
 * reconcile the two. The purchase lookup is inside it too, so the badge is read
 * from the same snapshot of the orders the review is attached to.
 *
 * The aggregates are updated **incrementally, not recomputed** from the stored
 * rows. The catalogue's `rating` and `review_count` cover a product's whole
 * history, of which only the most recent reviews are stored individually — a
 * recompute would collapse "4.3 over 183 reviews" to whatever the newest
 * reviewer typed. The arithmetic below is the previous in-memory formula,
 * unchanged, expressed in SQL.
 */
export async function createReview(input: NewReview): Promise<Review> {
  return db.transaction(async (tx) => {
    const verifiedPurchase = await hasPurchased(input.productId, input.userId, tx);

    const [row] = await tx
      .insert(reviews)
      .values({ ...input, verifiedPurchase, createdAt: new Date() })
      .returning();

    await tx
      .update(products)
      .set({
        reviewCount: sql`${products.reviewCount} + 1`,
        rating: sql`
          round(
            ((${products.rating} * ${products.reviewCount} + ${input.rating})
              / (${products.reviewCount} + 1))::numeric,
            1
          )::double precision
        `,
      })
      .where(eq(products.id, input.productId));

    return toReview(row!);
  });
}
