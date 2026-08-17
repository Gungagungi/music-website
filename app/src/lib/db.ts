import { randomUUID } from 'node:crypto';

import { hashPassword, verifyPassword } from '@/lib/password';
import productsSeed from '@/data/products.json';
import { COUPONS } from '@/data/coupons';
import { SEED_USERS } from '@/data/users';
import { SEED_REVIEWS } from '@/data/reviews';
import type { Cart, Coupon, Order, Product, Review, User } from '@/lib/types';

/**
 * In-memory database.
 *
 * A demo store does not need durable storage, but a *test* demo store very much
 * needs a cheap, total reset between specs. Holding everything in a single
 * module-level object gives `POST /api/test/reset` an O(1) implementation and
 * removes an entire class of flakiness (leftover rows, migrations, connection
 * pools) from the suite.
 *
 * The instance is pinned to `globalThis` so Next.js hot reloads and route
 * handlers compiled into separate module graphs share the same state.
 */

export interface Database {
  products: Product[];
  users: User[];
  carts: Map<string, Cart>;
  orders: Order[];
  reviews: Review[];
  coupons: Coupon[];
  counters: { order: number; user: number };
}

const PRODUCTS = productsSeed as unknown as Product[];

// Re-exported so existing callers keep working while the migration to PostgreSQL
// lands lot by lot. The implementations moved to lib/password.ts, which outlives
// this module.
export { hashPassword, verifyPassword };

function buildSeedDatabase(): Database {
  const users: User[] = SEED_USERS.map((seed) => ({
    id: seed.id,
    email: seed.email.toLowerCase(),
    firstName: seed.firstName,
    lastName: seed.lastName,
    passwordHash: hashPassword(seed.password),
    createdAt: seed.createdAt,
  }));

  const reviews: Review[] = SEED_REVIEWS.flatMap((seed, index) => {
    const product = PRODUCTS.find((candidate) => candidate.slug === seed.productSlug);
    if (!product) return [];
    return [
      {
        id: `REV-${String(index + 1).padStart(4, '0')}`,
        productId: product.id,
        userId: null,
        author: seed.author,
        rating: seed.rating,
        title: seed.title,
        body: seed.body,
        createdAt: seed.createdAt,
      },
    ];
  });

  return {
    // Deep clone so a mutation (stock decrement on checkout) never leaks into
    // the pristine seed and survives a reset.
    products: structuredClone(PRODUCTS),
    users,
    carts: new Map(),
    orders: [],
    reviews,
    coupons: structuredClone(COUPONS),
    counters: { order: 0, user: SEED_USERS.length },
  };
}

const globalRef = globalThis as typeof globalThis & { __fretlineDb?: Database };

export function getDb(): Database {
  if (!globalRef.__fretlineDb) {
    globalRef.__fretlineDb = buildSeedDatabase();
  }
  return globalRef.__fretlineDb;
}

/** Restores the database to its seeded state. Backs `POST /api/test/reset`. */
export function resetDb(): Database {
  globalRef.__fretlineDb = buildSeedDatabase();
  return globalRef.__fretlineDb;
}

export function nextOrderReference(): string {
  const db = getDb();
  db.counters.order += 1;
  return `FRT-${String(db.counters.order).padStart(6, '0')}`;
}

export function nextUserId(): string {
  const db = getDb();
  db.counters.user += 1;
  return `USR-${String(db.counters.user).padStart(4, '0')}`;
}

export function newId(): string {
  return randomUUID();
}
