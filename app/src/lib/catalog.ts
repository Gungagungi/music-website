import { CATEGORY_BY_SLUG } from '@/data/categories';
import {
  bestSellers as bestSellersRepo,
  categoryCounts as categoryCountsRepo,
  findProductById,
  findProductBySku,
  findProductBySlug,
  hotDeals as hotDealsRepo,
  listBrands as listBrandsRepo,
  newArrivals as newArrivalsRepo,
  priceRangeFor as priceRangeForRepo,
  queryProducts as queryProductsRepo,
} from '@/lib/repositories/products';
import {
  reviewPage as reviewPageRepo,
  reviewsForProduct as reviewsForProductRepo,
} from '@/lib/repositories/reviews';
import type {
  Paginated,
  Product,
  ProductQuery,
  Review,
  ReviewPage,
  ReviewQuery,
} from '@/lib/types';

/**
 * Catalogue reads.
 *
 * The filtering, ordering and pagination all happen in SQL now (see
 * lib/repositories/products.ts, and ADR-005). What stays here is the part that is
 * about the storefront rather than about storage: joining category labels, and
 * giving pages and route handlers one import to reach for.
 *
 * The seeded defect BUG-002 moved down with the query it belongs to.
 */

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/repositories/products';
export {
  DEFAULT_REVIEW_PAGE_SIZE,
  MAX_REVIEW_PAGE_SIZE,
} from '@/lib/repositories/reviews';

export function queryProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
  return queryProductsRepo(query);
}

export function getProductBySlug(slug: string): Promise<Product | undefined> {
  return findProductBySlug(slug);
}

export function getProductById(id: string): Promise<Product | undefined> {
  return findProductById(id);
}

export function getProductBySku(sku: string): Promise<Product | undefined> {
  return findProductBySku(sku);
}

export function listBrands(category?: string): Promise<{ name: string; count: number }[]> {
  return listBrandsRepo(category);
}

export function priceRangeFor(category?: string): Promise<{ min: number; max: number }> {
  return priceRangeForRepo(category);
}

/** Counts joined to their display label — the one piece the database has no opinion on. */
export async function categoryCounts(): Promise<{ slug: string; label: string; count: number }[]> {
  const counts = await categoryCountsRepo();
  return counts.map(({ slug, count }) => ({
    slug,
    label: CATEGORY_BY_SLUG.get(slug as never)?.label ?? slug,
    count,
  }));
}

export function reviewsForProduct(productId: string): Promise<Review[]> {
  return reviewsForProductRepo(productId);
}

export function reviewPage(productId: string, query: ReviewQuery = {}): Promise<ReviewPage> {
  return reviewPageRepo(productId, query);
}

export function bestSellers(limit = 8): Promise<Product[]> {
  return bestSellersRepo(limit);
}

export function newArrivals(limit = 8): Promise<Product[]> {
  return newArrivalsRepo(limit);
}

export function hotDeals(limit = 8): Promise<Product[]> {
  return hotDealsRepo(limit);
}
