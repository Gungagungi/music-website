import type { ProductQuery, SortKey } from '@/lib/types';
import { CATEGORY_SLUGS } from '@/lib/types';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'pertinence', label: 'Pertinence' },
  { value: 'prix-asc', label: 'Prix croissant' },
  { value: 'prix-desc', label: 'Prix décroissant' },
  { value: 'note', label: 'Meilleures notes' },
  { value: 'nouveautes', label: 'Nouveautés' },
];

/**
 * Catalog URLs use exactly the same parameter names and units as
 * `GET /api/products` — including prices in cents. Keeping a single vocabulary
 * means a filter can be reproduced from a page URL to an API call by copy and
 * paste, which is precisely what you want when triaging a bug report.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list.filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function toInt(value: string | string[] | undefined): number | undefined {
  const raw = first(value);
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBool(value: string | string[] | undefined): boolean | undefined {
  const raw = first(value);
  if (raw === undefined) return undefined;
  return raw === 'true' || raw === '1';
}

export function parseCatalogParams(params: RawSearchParams): ProductQuery {
  const sort = first(params.sort);
  const category = first(params.category);

  return {
    category: CATEGORY_SLUGS.includes(category as never) ? (category as never) : undefined,
    brands: toArray(params.brand),
    minPrice: toInt(params.minPrice),
    maxPrice: toInt(params.maxPrice),
    q: first(params.q)?.trim() || undefined,
    inStock: toBool(params.inStock),
    leftHanded: toBool(params.leftHanded),
    minRating: toInt(params.minRating),
    onSale: toBool(params.onSale),
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? (sort as SortKey) : undefined,
    page: toInt(params.page),
  };
}

/** Rebuilds a catalog query string, dropping empty values so URLs stay readable. */
export function buildCatalogHref(base: string, params: RawSearchParams, overrides: RawSearchParams): string {
  const search = new URLSearchParams();
  const merged: RawSearchParams = { ...params, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === '') continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry === '') continue;
      search.append(key, entry);
    }
  }

  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function activeFilterCount(query: ProductQuery): number {
  let count = 0;
  if (query.brands?.length) count += query.brands.length;
  if (query.minPrice !== undefined) count += 1;
  if (query.maxPrice !== undefined) count += 1;
  if (query.inStock) count += 1;
  if (query.leftHanded) count += 1;
  if (query.minRating !== undefined) count += 1;
  if (query.onSale) count += 1;
  return count;
}
