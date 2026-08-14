import { CATEGORY_BY_SLUG } from '@/data/categories';
import { getDb } from '@/lib/db';
import type { Paginated, Product, ProductQuery, Review, SortKey } from '@/lib/types';

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

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesQuery(product: Product, term: string): boolean {
  const haystack = normalise(`${product.brand} ${product.name} ${product.sku} ${product.category}`);
  return normalise(term)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  pertinence: () => 0,
  'prix-asc': (a, b) => a.price - b.price,
  'prix-desc': (a, b) => b.price - a.price,
  note: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
  nouveautes: (a, b) => b.releasedAt.localeCompare(a.releasedAt),
};

export function queryProducts(query: ProductQuery = {}): Paginated<Product> {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE));

  let items = db.products.slice();

  if (query.category) {
    items = items.filter((product) => product.category === query.category);
  }
  if (query.brands?.length) {
    const wanted = new Set(query.brands.map((brand) => brand.toLowerCase()));
    items = items.filter((product) => wanted.has(product.brand.toLowerCase()));
  }
  if (typeof query.minPrice === 'number') {
    items = items.filter((product) => product.price >= query.minPrice!);
  }
  if (typeof query.maxPrice === 'number') {
    items = items.filter((product) => product.price <= query.maxPrice!);
  }
  if (query.q) {
    items = items.filter((product) => matchesQuery(product, query.q!));
  }
  if (query.inStock) {
    items = items.filter((product) => product.stock > 0);
  }
  if (query.leftHanded) {
    items = items.filter((product) => product.leftHanded);
  }
  if (typeof query.minRating === 'number') {
    items = items.filter((product) => product.rating >= query.minRating!);
  }
  if (query.onSale) {
    items = items.filter((product) => product.discountPct > 0);
  }

  const sort = query.sort ?? 'pertinence';
  // The id tie-break is what makes the ordering total, and therefore what makes
  // pagination correct when several products share a price or a rating.
  const sortItems = (list: Product[]): Product[] => {
    if (sort === 'pertinence') return list;
    const compare = SORTERS[sort];
    return list.sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
  };

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  // Sorting must happen across the whole result set, before slicing. Doing it
  // the other way round yields pages that are each internally ordered but
  // globally wrong.
  const pageItems = SORT_AFTER_PAGINATION_ENABLED
    ? sortItems(items.slice(start, start + limit))
    : sortItems(items).slice(start, start + limit);

  return {
    items: pageItems,
    page,
    limit,
    total,
    totalPages,
  };
}

export function getProductBySlug(slug: string): Product | undefined {
  return getDb().products.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return getDb().products.find((product) => product.id === id);
}

export function getProductBySku(sku: string): Product | undefined {
  return getDb().products.find((product) => product.sku.toLowerCase() === sku.toLowerCase());
}

export function listBrands(category?: string): { name: string; count: number }[] {
  const db = getDb();
  const scope = category ? db.products.filter((product) => product.category === category) : db.products;
  const counts = new Map<string, number>();
  for (const product of scope) {
    counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function priceRangeFor(category?: string): { min: number; max: number } {
  const db = getDb();
  const scope = category ? db.products.filter((product) => product.category === category) : db.products;
  if (scope.length === 0) return { min: 0, max: 0 };
  const prices = scope.map((product) => product.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function categoryCounts(): { slug: string; label: string; count: number }[] {
  const db = getDb();
  const counts = new Map<string, number>();
  for (const product of db.products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([slug, count]) => ({
    slug,
    label: CATEGORY_BY_SLUG.get(slug as never)?.label ?? slug,
    count,
  }));
}

export function reviewsForProduct(productId: string): Review[] {
  return getDb()
    .reviews.filter((review) => review.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function bestSellers(limit = 8): Product[] {
  return getDb()
    .products.filter((product) => product.bestSeller)
    .sort((a, b) => b.reviewCount - a.reviewCount || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function newArrivals(limit = 8): Product[] {
  return getDb()
    .products.filter((product) => product.isNew)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function hotDeals(limit = 8): Product[] {
  return getDb()
    .products.filter((product) => product.discountPct > 0)
    .sort((a, b) => b.discountPct - a.discountPct || a.id.localeCompare(b.id))
    .slice(0, limit);
}
