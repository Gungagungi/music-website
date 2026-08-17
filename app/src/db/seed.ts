import { pathToFileURL } from 'node:url';

import { sql } from 'drizzle-orm';

import { closePool, db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { cartItems, carts, coupons, orderItems, orders, products, reviews, users } from '@/db/schema';
import { COUPONS } from '@/data/coupons';
import productsSeed from '@/data/products.json';
import { SEED_REVIEWS } from '@/data/reviews';
import { SEED_USERS } from '@/data/users';
import { seedPasswordHash } from '@/lib/password';
import type { Product } from '@/lib/types';

const PRODUCTS = productsSeed as unknown as Product[];

/**
 * Sequence values the seed leaves behind.
 *
 * `TRUNCATE ... RESTART IDENTITY` only resets sequences *owned* by an identity
 * column, and these two are standalone, so they have to be set explicitly. Getting
 * this wrong is quiet and nasty: the schema still works, but the first account
 * registered after a reset stops being USR-0004 and specs that hard-code it fail
 * somewhere unrelated.
 */
const SEEDED_USER_COUNT = SEED_USERS.length;

function productRows() {
  return PRODUCTS.map((product, index) => ({
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    listPrice: product.listPrice,
    discountPct: product.discountPct,
    currency: product.currency,
    stock: product.stock,
    rating: product.rating,
    reviewCount: product.reviewCount,
    releasedAt: product.releasedAt,
    bestSeller: product.bestSeller,
    isNew: product.isNew,
    leftHanded: product.leftHanded,
    colors: product.colors,
    specs: product.specs,
    description: product.description,
    // Freezes the order of data/products.json, which is what the `pertinence`
    // sort returns today.
    seedPosition: index,
  }));
}

function userRows() {
  return SEED_USERS.map((seed) => ({
    id: seed.id,
    email: seed.email.toLowerCase(),
    firstName: seed.firstName,
    lastName: seed.lastName,
    passwordHash: seedPasswordHash(seed.password),
    createdAt: new Date(seed.createdAt),
  }));
}

function couponRows() {
  return COUPONS.map((coupon) => ({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    category: coupon.category,
    expiresAt: coupon.expiresAt,
    description: coupon.description,
  }));
}

function reviewRows() {
  const idBySlug = new Map(PRODUCTS.map((product) => [product.slug, product.id]));
  // `index` counts over the whole seed array, not over the rows that survive, so
  // a review pointing at an unknown slug leaves a gap in the identifiers rather
  // than shifting every later one. That matches the in-memory build exactly.
  return SEED_REVIEWS.flatMap((seed, index) => {
    const productId = idBySlug.get(seed.productSlug);
    if (!productId) return [];
    return [
      {
        id: `REV-${String(index + 1).padStart(4, '0')}`,
        productId,
        userId: null,
        author: seed.author,
        rating: seed.rating,
        title: seed.title,
        body: seed.body,
        createdAt: new Date(seed.createdAt),
      },
    ];
  });
}

/**
 * Inserts the seed data. Idempotent, so it is safe to run on every deployment:
 * an existing row is left alone rather than overwritten, which means a production
 * stock level survives a redeploy.
 */
export async function seedDatabase(executor: DbOrTx = db): Promise<void> {
  await executor.insert(products).values(productRows()).onConflictDoNothing();
  await executor.insert(users).values(userRows()).onConflictDoNothing();
  await executor.insert(coupons).values(couponRows()).onConflictDoNothing();

  const rows = reviewRows();
  if (rows.length > 0) {
    await executor.insert(reviews).values(rows).onConflictDoNothing();
  }

  await syncSequences(executor);
}

/**
 * Parks the sequences past the seeded identifiers.
 *
 * `is_called = true` on user_id_seq means the next call yields 4 → USR-0004.
 * `is_called = false` on order_ref_seq means the next call yields 1 → FRT-000001,
 * because no order ships with the seed.
 */
async function syncSequences(executor: DbOrTx): Promise<void> {
  await executor.execute(sql`SELECT setval('user_id_seq', ${SEEDED_USER_COUNT}, true)`);
  await executor.execute(sql`SELECT setval('order_ref_seq', 1, false)`);
}

export interface ResetSummary {
  products: number;
  users: number;
  orders: number;
  carts: number;
}

/**
 * Restores the seeded state — the SQL replacement for `resetDb()`.
 *
 * Everything happens in one transaction: a reset that failed halfway would leave
 * an empty catalogue behind, and the suite would report dozens of unrelated
 * failures instead of one clear error.
 *
 * `RESTART IDENTITY CASCADE` is redundant with listing every table by name, and
 * kept deliberately: it makes the statement correct even if a future table is
 * added and someone forgets to add it here.
 */
export async function resetDatabase(): Promise<ResetSummary> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE TABLE
        ${orderItems}, ${orders}, ${cartItems}, ${carts},
        ${reviews}, ${products}, ${users}, ${coupons}
      RESTART IDENTITY CASCADE
    `);

    await seedDatabase(tx);

    // Counted rather than assumed. The suite asserts these numbers, so deriving
    // them from the seed constants would make the assertion agree with itself.
    const [counts] = await tx
      .execute<{ products: string; users: string; orders: string; carts: string }>(sql`
        SELECT
          (SELECT count(*) FROM ${products}) AS products,
          (SELECT count(*) FROM ${users})    AS users,
          (SELECT count(*) FROM ${orders})   AS orders,
          (SELECT count(*) FROM ${carts})    AS carts
      `)
      .then((result) => result.rows);

    return {
      products: Number(counts?.products ?? 0),
      users: Number(counts?.users ?? 0),
      orders: Number(counts?.orders ?? 0),
      carts: Number(counts?.carts ?? 0),
    };
  });
}

/** True when the catalogue has never been loaded — used by the production seed command. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const result = await db.execute<{ count: string }>(
    sql`SELECT count(*) AS count FROM ${products}`,
  );
  return Number(result.rows[0]?.count ?? 0) === 0;
}

/** True when this module was launched directly, false when imported. */
function runAsScript(): boolean {
  const invoked = process.argv[1];
  return Boolean(invoked && import.meta.url === pathToFileURL(invoked).href);
}

if (runAsScript()) {
  seedDatabase()
    .then(() => console.log('[db] graines insérées'))
    .catch((error: unknown) => {
      console.error('[db] échec du seed :', error);
      process.exitCode = 1;
    })
    .finally(closePool);
}
