import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { FacetPanel } from '@/components/FacetPanel';
import { Pagination } from '@/components/Pagination';
import { ProductGrid } from '@/components/ProductGrid';
import { SortSelect } from '@/components/SortSelect';
import { CATEGORY_BY_SLUG } from '@/data/categories';
import { guidesForCategory } from '@/data/guides';
import { listBrands, priceRangeFor, queryProducts } from '@/lib/catalog';
import { activeFilterCount, buildCatalogHref, parseCatalogParams } from '@/lib/search-params';
import type { CategorySlug } from '@/lib/types';
import type { RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const definition = CATEGORY_BY_SLUG.get(category as CategorySlug);
  return { title: definition ? definition.label : 'Catégorie introuvable' };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category } = await params;
  const definition = CATEGORY_BY_SLUG.get(category as CategorySlug);
  if (!definition) notFound();

  const raw = await searchParams;
  const query = { ...parseCatalogParams(raw), category: definition.slug };
  const guides = guidesForCategory(definition.slug);
  // The shelf and its two facets do not depend on each other — one round trip.
  const [result, brands, priceBounds] = await Promise.all([
    queryProducts(query),
    listBrands(definition.slug),
    priceRangeFor(definition.slug),
  ]);
  const filterCount = activeFilterCount(query);

  const baseParams: RawSearchParams = { ...raw };
  delete baseParams.category;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb
        trail={[
          { label: 'Accueil', href: '/' },
          { label: definition.group },
          { label: definition.label },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold" data-testid="category-title">
        {definition.label}
      </h1>
      <p className="mt-2 max-w-3xl text-fg-muted">{definition.tagline}</p>

      {/* A shelf links to the guide written for it, when there is one. The guide
          names its own category, so no second table maps the two. */}
      {guides.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3 text-sm" data-testid="category-guides">
          {guides.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="underline hover:text-amber-brand"
                data-testid="category-guide-link"
              >
                {guide.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <FacetPanel brands={brands} priceBounds={priceBounds} />

        <section aria-label="Résultats">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted" data-testid="result-count">
              <strong data-testid="result-count-value">{result.total}</strong>{' '}
              {result.total > 1 ? 'produits' : 'produit'}
              {filterCount > 0 && (
                <span data-testid="active-filter-count">
                  {' '}
                  · {filterCount} filtre{filterCount > 1 ? 's' : ''} actif
                  {filterCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <SortSelect />
          </div>

          <div className="mt-4">
            {result.items.length === 0 ? (
              <div
                className="rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center"
                data-testid="empty-results"
              >
                <p className="text-lg font-semibold">Aucun produit ne correspond à ces critères.</p>
                <p className="mt-2 text-sm text-fg-muted">
                  Élargissez la fourchette de prix ou retirez un filtre pour voir plus de résultats.
                </p>
                <Link
                  href={`/c/${definition.slug}`}
                  className="mt-4 inline-block rounded bg-contrast px-4 py-2 text-sm font-semibold text-contrast-fg"
                  data-testid="empty-results-reset"
                >
                  Réinitialiser les filtres
                </Link>
              </div>
            ) : (
              <ProductGrid products={result.items} />
            )}
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={(page) =>
              buildCatalogHref(`/c/${definition.slug}`, baseParams, {
                page: page === 1 ? undefined : String(page),
              })
            }
          />
        </section>
      </div>
    </div>
  );
}
