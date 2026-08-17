import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toReview } from '@/db/mappers';
import { products, reviews } from '@/db/schema';
import type { Review } from '@/lib/types';

/** Reads and writes on `reviews`. */

export async function reviewsForProduct(
  productId: string,
  executor: DbOrTx = db,
): Promise<Review[]> {
  const rows = await executor
    .select()
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .orderBy(desc(reviews.createdAt));
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
 * reconcile the two.
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
    const [row] = await tx.insert(reviews).values({ ...input, createdAt: new Date() }).returning();

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
