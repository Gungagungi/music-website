import type { InferSelectModel } from 'drizzle-orm';

import type { coupons, products, reviews, users } from '@/db/schema';
import type { Coupon, Product, Review, User } from '@/lib/types';

/**
 * Row → domain translation, kept in one place.
 *
 * `lib/types.ts` is the contract with the storefront, with the REST API and — by
 * way of `e2e/data/seed.ts` — with the test suite. Storage details must not leak
 * into it, so every difference between a table row and a domain object is
 * resolved here rather than at each call site: dropped storage-only columns,
 * timestamps rendered back to ISO strings, nullable columns normalised.
 */

type ProductRow = InferSelectModel<typeof products>;
type UserRow = InferSelectModel<typeof users>;
type CouponRow = InferSelectModel<typeof coupons>;
type ReviewRow = InferSelectModel<typeof reviews>;

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    listPrice: row.listPrice,
    discountPct: row.discountPct,
    currency: row.currency as 'EUR',
    stock: row.stock,
    rating: row.rating,
    reviewCount: row.reviewCount,
    releasedAt: row.releasedAt,
    bestSeller: row.bestSeller,
    isNew: row.isNew,
    leftHanded: row.leftHanded,
    colors: row.colors,
    specs: row.specs,
    description: row.description,
    // `seedPosition` and `searchText` stay behind: they order and index rows, and
    // mean nothing to a caller.
  };
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotal: row.minSubtotal,
    category: row.category ?? null,
    // Stored as text on purpose — see the column comment. It goes back out
    // exactly as it came in, `2020-12-31` included.
    expiresAt: row.expiresAt,
    description: row.description,
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.productId,
    userId: row.userId,
    author: row.author,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
