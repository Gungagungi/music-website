import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { CATEGORY_SLUGS } from '@/lib/types';
import type { Address, CartTotals, CategorySlug, OrderStatus, PaymentMethod } from '@/lib/types';

/**
 * Schema notes that are not obvious from the column list:
 *
 * - **Every monetary column is `integer`, in cents.** `lib/money.ts` exists to keep
 *   floats out of money; a `numeric` or `real` column would reintroduce them at the
 *   storage layer and defeat the whole convention.
 * - **`rating` is `double precision`, deliberately.** Both PostgreSQL float8 and a
 *   JavaScript number are IEEE-754 binary64, so a rating round-trips to the exact
 *   value `JSON.parse` produces today and `rating >= 4.5` filters identically.
 *   `real` (binary32) would quietly change the seeded values.
 * - **Derived values are not stored.** `cart.totals` and `cart_items.line_total` are
 *   recomputed by `recalc()` on every mutation; persisting them would only create a
 *   second source of truth to drift.
 * - **Order rows are snapshots.** Prices, names and addresses are frozen at checkout
 *   so that a later catalogue edit cannot rewrite history.
 */

const categoryList = CATEGORY_SLUGS.map((slug) => `'${slug}'`).join(', ');

/* -------------------------------------------------------------------------- */
/* Sequences                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Standalone sequences, formatted application-side into `USR-0004` / `FRT-000001`.
 *
 * Caution: `TRUNCATE ... RESTART IDENTITY` only resets sequences *owned* by an
 * identity column, which these are not. `resetDatabase()` has to `setval` them
 * explicitly, in the same transaction, or the first account registered after a
 * reset stops being `USR-0004` — an invariant the suite asserts.
 */
export const userIdSeq = pgSequence('user_id_seq', { startWith: 4 });
export const orderRefSeq = pgSequence('order_ref_seq', { startWith: 1 });

/* -------------------------------------------------------------------------- */
/* products                                                                   */
/* -------------------------------------------------------------------------- */

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    sku: text('sku').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    category: text('category').$type<CategorySlug>().notNull(),
    /** Cents, VAT included. */
    price: integer('price').notNull(),
    /** Cents before discount, null when the product is not discounted. */
    listPrice: integer('list_price'),
    discountPct: integer('discount_pct').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    stock: integer('stock').notNull().default(0),
    rating: doublePrecision('rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    releasedAt: text('released_at').notNull(),
    bestSeller: boolean('best_seller').notNull().default(false),
    isNew: boolean('is_new').notNull().default(false),
    leftHanded: boolean('left_handed').notNull().default(false),
    colors: text('colors').array().notNull().default(sql`'{}'::text[]`),
    specs: jsonb('specs').$type<Record<string, string>>().notNull().default({}),
    description: text('description').notNull(),
    /**
     * Insertion order of `data/products.json`. The `pertinence` sort returns the
     * seed order today; ordering by this column reproduces it exactly, without
     * betting on that file happening to be sorted by id.
     */
    seedPosition: integer('seed_position').notNull(),
    /**
     * Accent- and case-folded haystack, mirroring `normalise()` in lib/catalog.ts.
     *
     * Backed by `fretline_unaccent()` rather than `unaccent()` directly: the stock
     * function is only STABLE (its dictionary can be reloaded), and PostgreSQL
     * refuses a non-IMMUTABLE function in a generated column or an index. The
     * wrapper pins the dictionary via the two-argument form, which is immutable in
     * practice. It is created in the migration prelude, before this table.
     */
    searchText: text('search_text').generatedAlwaysAs(
      sql`fretline_unaccent(lower(brand || ' ' || name || ' ' || sku || ' ' || category))`,
    ),
  },
  (table) => [
    // pg_trgm, not tsvector. The current search is substring matching
    // (`haystack.includes(token)`), so a full-text index would introduce stemming
    // and word boundaries — different results, no real regression, red specs.
    index('products_search_trgm_idx').using('gin', sql`${table.searchText} gin_trgm_ops`),
    uniqueIndex('products_sku_key').on(table.sku),
    uniqueIndex('products_slug_key').on(table.slug),
    index('products_category_idx').on(table.category),
    index('products_brand_idx').on(table.brand),
    index('products_price_idx').on(table.price),
    index('products_seed_position_idx').on(table.seedPosition),
    // A backstop the application cannot talk its way around: even a wrong stock
    // decrement cannot produce a negative shelf. This constraint is itself worth
    // a test case.
    check('products_stock_non_negative', sql`${table.stock} >= 0`),
    check('products_rating_range', sql`${table.rating} >= 0 AND ${table.rating} <= 5`),
    check('products_category_known', sql.raw(`category IN (${categoryList})`)),
  ],
);

/* -------------------------------------------------------------------------- */
/* users                                                                      */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    /** `${salt}:${scryptHash}` — never leaves the server. */
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness at the storage layer, so two concurrent
    // registrations for the same address cannot both succeed.
    uniqueIndex('users_email_lower_key').on(sql`lower(${table.email})`),
  ],
);

/* -------------------------------------------------------------------------- */
/* coupons                                                                    */
/* -------------------------------------------------------------------------- */

/** The code is the natural key: it identifies the coupon in the UI, the API and the domain. */
export const coupons = pgTable(
  'coupons',
  {
    code: text('code').primaryKey(),
    type: text('type').$type<'percent' | 'fixed'>().notNull(),
    /** Percentage points for `percent`, cents for `fixed`. */
    value: integer('value').notNull(),
    minSubtotal: integer('min_subtotal').notNull().default(0),
    category: text('category').$type<CategorySlug | null>(),
    /**
     * Stored verbatim as text, not as a timestamptz. The seed holds `2020-12-31`
     * — a date with no time — and `evaluateCoupon` compares it in JavaScript, never
     * in SQL. Round-tripping it through a timestamp would hand the API back
     * `2020-12-31T00:00:00.000Z` and silently change the response payload.
     */
    expiresAt: text('expires_at'),
    description: text('description').notNull(),
  },
  (table) => [
    check('coupons_code_upper', sql`${table.code} = upper(${table.code})`),
    check('coupons_type_known', sql`${table.type} IN ('percent', 'fixed')`),
    check('coupons_value_positive', sql`${table.value} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* carts                                                                      */
/* -------------------------------------------------------------------------- */

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  couponCode: text('coupon_code').references(() => coupons.code, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * `sku`, `slug`, `name`, `brand` and `unit_price` are denormalised on purpose: the
 * application freezes them when the line is added, which is what a shop should do —
 * a price revision must not silently rewrite a cart someone is looking at.
 */
export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    color: text('color'),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    /** Preserves the order lines were added in, which the cart page relies on. */
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('cart_items_cart_idx').on(table.cartId),
    // Mirrors the de-duplication in `addItem`. NULLS NOT DISTINCT is required
    // (PostgreSQL 15+): `color` is nullable, and by default two NULLs compare as
    // distinct, so the constraint would not fire on colourless products.
    unique('cart_items_unique_line')
      .on(table.cartId, table.productId, table.color)
      .nullsNotDistinct(),
    check('cart_items_quantity_range', sql`${table.quantity} BETWEEN 1 AND 10`),
  ],
);

/* -------------------------------------------------------------------------- */
/* orders                                                                     */
/* -------------------------------------------------------------------------- */

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    /** Value object, frozen at checkout, never queried field by field. */
    totals: jsonb('totals').$type<CartTotals>().notNull(),
    /**
     * Plain text, no foreign key: the order must keep a record of the code even
     * after the coupon itself is withdrawn.
     */
    couponCode: text('coupon_code'),
    shippingAddress: jsonb('shipping_address').$type<Address>().notNull(),
    billingAddress: jsonb('billing_address').$type<Address>().notNull(),
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
    status: text('status').$type<OrderStatus>().notNull().default('confirmee'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    /** Returned once at creation so a guest can open their own confirmation page. */
    accessToken: uuid('access_token').notNull().defaultRandom(),
  },
  (table) => [
    uniqueIndex('orders_reference_key').on(table.reference),
    index('orders_user_idx').on(table.userId),
    index('orders_created_at_idx').on(table.createdAt),
    check(
      'orders_status_known',
      sql`${table.status} IN ('confirmee', 'en_preparation', 'expediee', 'livree', 'annulee')`,
    ),
    check('orders_payment_method_known', sql`${table.paymentMethod} IN ('carte', 'virement', 'paypal')`),
  ],
);

/**
 * Normalised rather than embedded in `orders`, so the product reference stays a real
 * foreign key. `ON DELETE RESTRICT` then makes "a sold product cannot be deleted" an
 * integrity rule the database enforces, not a convention the application remembers.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    color: text('color'),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: integer('line_total').notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('order_items_order_idx').on(table.orderId),
    index('order_items_product_idx').on(table.productId),
    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* reviews                                                                    */
/* -------------------------------------------------------------------------- */

export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    author: text('author').notNull(),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /**
     * Frozen when the review is published — see the `Review` type. A read-time
     * join would move the badge on an old review the day its author finally
     * bought the product.
     */
    verifiedPurchase: boolean('verified_purchase').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('reviews_product_idx').on(table.productId),
    // The review list sorts by date and by rating, and pages through the result.
    // Both orders break the tie on `id`, so the index carries it too.
    index('reviews_product_created_idx').on(table.productId, table.createdAt, table.id),
    index('reviews_product_rating_idx').on(table.productId, table.rating, table.id),
    check('reviews_rating_range', sql`${table.rating} BETWEEN 1 AND 5`),
    // One opinion per customer and per product. The application checks it first
    // to answer 409 rather than 500, but two concurrent posts would both pass
    // that check — this is what actually makes it true. Anonymous seed reviews
    // carry a NULL user, and NULLs stay distinct here, deliberately.
    uniqueIndex('reviews_product_user_key').on(table.productId, table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* stock_alerts                                                               */
/* -------------------------------------------------------------------------- */

/**
 * "Tell me when this is back in stock."
 *
 * Attached to an account rather than to a bare e-mail address, deliberately.
 * An address alone is a subscription anybody can create for somebody else, and
 * unsubscribing it needs a token, a link and a whole flow of its own. Requiring
 * an account makes the owner of the alert the person who asked for it, which is
 * also what makes "my alerts" listable and removable.
 *
 * `notified_at` is the whole state machine: NULL means waiting, a timestamp
 * means the restock mail went out. The row is kept afterwards rather than
 * deleted, so a second restock does not silently re-notify someone who never
 * asked twice.
 */
export const stockAlerts = pgTable(
  'stock_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    notifiedAt: timestamp('notified_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('stock_alerts_user_idx').on(table.userId),
    // The sweep looks for pending alerts on products that came back: both
    // columns, and the NULL check, are in this index.
    index('stock_alerts_pending_idx')
      .on(table.productId)
      .where(sql`${table.notifiedAt} IS NULL`),
    // One pending alert per customer and per product. Subscribing twice is a
    // double-click, not a request to be told twice.
    uniqueIndex('stock_alerts_unique').on(table.productId, table.userId),
  ],
);
