import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { Pagination } from '@/components/Pagination';
import { ProductGrid } from '@/components/ProductGrid';
import { SortSelect } from '@/components/SortSelect';
import { CATEGORIES } from '@/data/categories';
import { queryProducts } from '@/lib/catalog';
import { buildCatalogHref, parseCatalogParams } from '@/lib/search-params';
import type { RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Recherche' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = parseCatalogParams(raw);
  const term = query.q ?? '';
  const result = term ? queryProducts(query) : { items: [], page: 1, limit: 12, total: 0, totalPages: 1 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Recherche' }]} />

      <h1 className="mt-4 text-3xl font-bold" data-testid="search-title">
        {term ? `Résultats pour « ${term} »` : 'Recherche'}
      </h1>

      {!term ? (
        <div className="mt-6 rounded-lg border border-dashed border-ink-300 bg-white p-10" data-testid="search-prompt">
          <p className="text-lg font-semibold">Saisissez un terme de recherche.</p>
          <p className="mt-2 text-sm text-ink-500">
            Vous pouvez chercher par marque, par modèle ou par référence.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.slice(0, 5).map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/c/${category.slug}`}
                  className="rounded border border-ink-100 px-3 py-1 text-sm hover:border-amber-brand"
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500" data-testid="result-count">
              <strong data-testid="result-count-value">{result.total}</strong>{' '}
              {result.total > 1 ? 'produits trouvés' : 'produit trouvé'}
            </p>
            <SortSelect />
          </div>

          <div className="mt-4">
            {result.items.length === 0 ? (
              <div
                className="rounded-lg border border-dashed border-ink-300 bg-white p-10 text-center"
                data-testid="empty-results"
              >
                <p className="text-lg font-semibold">
                  Aucun produit ne correspond à « {term} ».
                </p>
                <p className="mt-2 text-sm text-ink-500">
                  Vérifiez l’orthographe ou essayez un terme plus général, comme « stratocaster » ou
                  « ampli ».
                </p>
              </div>
            ) : (
              <ProductGrid products={result.items} />
            )}
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={(page) =>
              buildCatalogHref('/recherche', raw, { page: page === 1 ? undefined : String(page) })
            }
          />
        </>
      )}
    </div>
  );
}
