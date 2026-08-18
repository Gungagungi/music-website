import { and, asc, desc, eq, getTableColumns, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toProduct } from '@/db/mappers';
import { products } from '@/db/schema';
import type { Paginated, Product, ProductQuery, SortKey } from '@/lib/types';

/** Reads and writes on `products`. */

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

/**
 * Category of each of the given products, in one query.
 *
 * Exists so the cart's pricing maths can stay synchronous and pure. Coupons that
 * are restricted to a category need to know what each line belongs to, and
 * looking that up per line would issue one query per item — from inside a
 * function that is called several times per recalculation.
 *
 * The alternative, carrying the category on `CartItem`, was rejected: that type
 * is part of the API payload and is mirrored by `e2e/data/seed.ts`.
 */
export async function categoriesForProducts(
  productIds: string[],
  executor: DbOrTx = db,
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await executor
    .select({ id: products.id, category: products.category })
    .from(products)
    .where(inArray(products.id, productIds));
  return new Map(rows.map((row) => [row.id, row.category]));
}

export async function countProducts(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(products);
  return row?.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Catalogue query                                                            */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

/**
 * One deliberately seeded defect, gated behind SEED_BUGS=1.
 * See docs/bug-reports/BUG-002-sort-after-pagination.md — with the flag on, the
 * result set is sliced *before* being sorted, so each page is ordered only
 * within itself. Page 2 then opens with an item cheaper than the last one on
 * page 1, which is one of the most common ordering bugs in real catalogues.
 */
const SORT_AFTER_PAGINATION_ENABLED = process.env.SEED_BUGS === '1';

/**
 * Strips accents and folds case the same way `normalise()` used to in JavaScript.
 *
 * The comparison is a plain substring match, not full-text search: the previous
 * implementation was `haystack.includes(token)`, and a tsvector index would bring
 * stemming and word boundaries with it. "strat mn" and "basse 5" both stop
 * matching under those rules — different results, no real regression, red specs.
 */
function searchConditions(term: string): SQL[] {
  return term
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (token) => sql`${products.searchText} LIKE '%' || fretline_unaccent(lower(${token})) || '%'`,
    );
}

function filtersFor(query: ProductQuery): SQL[] {
  const conditions: SQL[] = [];

  if (query.category) conditions.push(eq(products.category, query.category));
  if (query.brands?.length) {
    // Compared folded on both sides, as the JavaScript filter did with its Set of
    // lower-cased names. `inArray` rather than `= ANY(…)`: drizzle expands a
    // template-interpolated array into one placeholder per element, which
    // PostgreSQL then rejects as a non-array right-hand side.
    const wanted = query.brands.map((brand) => brand.toLowerCase());
    conditions.push(inArray(sql`lower(${products.brand})`, wanted));
  }
  if (typeof query.minPrice === 'number') conditions.push(gte(products.price, query.minPrice));
  if (typeof query.maxPrice === 'number') conditions.push(lte(products.price, query.maxPrice));
  if (query.q) conditions.push(...searchConditions(query.q));
  if (query.inStock) conditions.push(gt(products.stock, 0));
  if (query.leftHanded) conditions.push(eq(products.leftHanded, true));
  if (typeof query.minRating === 'number') conditions.push(gte(products.rating, query.minRating));
  if (query.onSale) conditions.push(gt(products.discountPct, 0));

  return conditions;
}

/**
 * Columns the ordering needs, from either the table or a subquery over it.
 *
 * Parameterised because the seeded defect sorts a subquery, whose columns are
 * distinct objects from the table's: ordering the outer query by `products.price`
 * would reference a relation that is not in scope there.
 */
interface OrderSource {
  id: SQLWrapper;
  price: SQLWrapper;
  rating: SQLWrapper;
  reviewCount: SQLWrapper;
  releasedAt: SQLWrapper;
  seedPosition: SQLWrapper;
}

/**
 * Ordering clause for a sort key.
 *
 * Every key ends on `id`, which is what makes the ordering total — and therefore
 * what makes pagination correct when several products share a price or a rating.
 * Without it PostgreSQL is free to return tied rows in any order it likes, and
 * two requests for the same page can disagree.
 *
 * `pertinence` is the exception: it kept the seed order and applied no tie-break
 * at all, so it orders by `seed_position`, which is already unique.
 *
 * `released_at` is compared under the C collation. The column holds fixed-format
 * ISO timestamps, so byte order is chronological order; the default locale
 * collation would instead give punctuation its own rules for no benefit here.
 */
function orderingFor(sort: SortKey, source: OrderSource): SQL[] {
  switch (sort) {
    case 'prix-asc':
      return [asc(source.price), asc(source.id)];
    case 'prix-desc':
      return [desc(source.price), asc(source.id)];
    case 'note':
      return [desc(source.rating), desc(source.reviewCount), asc(source.id)];
    case 'nouveautes':
      return [sql`${source.releasedAt} COLLATE "C" DESC`, asc(source.id)];
    case 'pertinence':
    default:
      return [asc(source.seedPosition)];
  }
}

/* -------------------------------------------------------------------------- */
/* Facets and shelves                                                         */
/* -------------------------------------------------------------------------- */

const inCategory = (category?: string) =>
  category ? eq(products.category, category as never) : undefined;

/**
 * Brand facet, optionally scoped to one category.
 *
 * Grouped in SQL, ordered in JavaScript. `localeCompare(…, 'fr')` is what the
 * facet used before, and reproducing it in SQL would mean betting on an ICU
 * collation being present in whatever image the database runs from. Two dozen
 * rows make the choice free.
 */
export async function listBrands(
  category?: string,
  executor: DbOrTx = db,
): Promise<{ name: string; count: number }[]> {
  const rows = await executor
    .select({ name: products.brand, count: sql<number>`count(*)::int` })
    .from(products)
    .where(inCategory(category))
    .groupBy(products.brand);

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function priceRangeFor(
  category?: string,
  executor: DbOrTx = db,
): Promise<{ min: number; max: number }> {
  const [row] = await executor
    .select({
      min: sql<number | null>`min(${products.price})::int`,
      max: sql<number | null>`max(${products.price})::int`,
    })
    .from(products)
    .where(inCategory(category));

  // An empty shelf has no range rather than a zero-width one at zero — the
  // previous implementation returned {0, 0} for the same case.
  return { min: row?.min ?? 0, max: row?.max ?? 0 };
}

/**
 * Category facet.
 *
 * Ordered by the first seed position in each category, which is the order the
 * old implementation produced: it filled a Map while walking the catalogue, and
 * a Map iterates in insertion order.
 */
export async function categoryCounts(
  executor: DbOrTx = db,
): Promise<{ slug: string; count: number }[]> {
  return executor
    .select({ slug: products.category, count: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.category)
    .orderBy(sql`min(${products.seedPosition})`);
}

async function shelf(
  where: SQL,
  ordering: SQL[],
  limit: number,
  executor: DbOrTx,
): Promise<Product[]> {
  const rows = await executor
    .select()
    .from(products)
    .where(where)
    .orderBy(...ordering)
    .limit(limit);
  return rows.map(toProduct);
}

export function bestSellers(limit = 8, executor: DbOrTx = db): Promise<Product[]> {
  return shelf(
    eq(products.bestSeller, true),
    [desc(products.reviewCount), asc(products.id)],
    limit,
    executor,
  );
}

export function newArrivals(limit = 8, executor: DbOrTx = db): Promise<Product[]> {
  return shelf(
    eq(products.isNew, true),
    [sql`${products.releasedAt} COLLATE "C" DESC`, asc(products.id)],
    limit,
    executor,
  );
}

export function hotDeals(limit = 8, executor: DbOrTx = db): Promise<Product[]> {
  return shelf(
    gt(products.discountPct, 0),
    [desc(products.discountPct), asc(products.id)],
    limit,
    executor,
  );
}

async function countMatching(where: SQL | undefined, executor: DbOrTx): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  return row?.count ?? 0;
}

export async function queryProducts(
  query: ProductQuery = {},
  executor: DbOrTx = db,
): Promise<Paginated<Product>> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  const conditions = filtersFor(query);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const sort = query.sort ?? 'pertinence';

  // Counted with a window function rather than a second query: it is evaluated
  // before LIMIT, so it reports the size of the whole filtered set from the same
  // round trip — and it stays correct when the defect below reorders the page.
  // `.as('total')` is not decoration: the defect below reads this selection back
  // out of a subquery, and drizzle can only project a field it can name.
  const selection = {
    ...getTableColumns(products),
    total: sql<number>`count(*) OVER ()::int`.as('total'),
  };

  const rows = SORT_AFTER_PAGINATION_ENABLED
    ? // BUG-002. The page is cut out of the seed order first, then sorted on its
      // own, so each page is internally tidy and the sequence across pages is
      // wrong — page 2 opens with an item cheaper than the last one on page 1.
      // Structurally the same mistake as sorting the slice in JavaScript instead
      // of the whole result set.
      await (async () => {
        const sliced = executor
          .select(selection)
          .from(products)
          .where(where)
          .orderBy(asc(products.seedPosition))
          .limit(limit)
          .offset(offset)
          .as('page');
        return executor.select().from(sliced).orderBy(...orderingFor(sort, sliced));
      })()
    : await executor
        .select(selection)
        .from(products)
        .where(where)
        .orderBy(...orderingFor(sort, products))
        .limit(limit)
        .offset(offset);

  // `count(*) OVER ()` rides along on the returned rows, so it says nothing when
  // the page is empty — asking for page 99 of a 7-page catalogue would report a
  // total of 0 and hide the fact that the catalogue is not empty, just overshot.
  // The extra query only fires in that case.
  const total =
    rows.length > 0 ? (rows[0]?.total ?? 0) : await countMatching(where, executor);

  return {
    items: rows.map(toProduct),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
