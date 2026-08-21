import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { PriceTag } from '@/components/PriceTag';
import { Rating } from '@/components/Rating';
import { getProductBySlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Comparateur' };

export const MAX_COMPARED = 3;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ refs?: string }>;
}) {
  const { refs } = await searchParams;
  const slugs = (refs ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARED);

  // Fetched in parallel, then the unknown slugs are dropped — the comparator is
  // reached by hand-edited URLs, so a stale reference must narrow the table
  // rather than fail the page.
  const products = (await Promise.all(slugs.map((slug) => getProductBySlug(slug)))).filter(
    (product): product is NonNullable<typeof product> => Boolean(product),
  );

  // The union of every spec key, so rows line up even when models describe
  // themselves with different attributes.
  const specKeys = [...new Set(products.flatMap((product) => Object.keys(product.specs)))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Comparateur' }]} />

      <h1 className="mt-4 text-3xl font-bold" data-testid="compare-title">
        Comparateur
      </h1>
      <p className="mt-2 text-fg-muted">
        Comparez jusqu’à {MAX_COMPARED} produits côte à côte.
      </p>

      {products.length === 0 ? (
        <div
          className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface p-12 text-center"
          data-testid="compare-empty"
        >
          <p className="text-lg font-semibold">Aucun produit à comparer.</p>
          <p className="mt-2 text-sm text-fg-muted">
            Depuis une fiche produit, utilisez le lien « Comparer ce produit ».
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse bg-surface text-sm" data-testid="compare-table">
            <caption className="sr-only">Comparaison des produits sélectionnés</caption>
            <thead>
              <tr>
                <th scope="col" className="w-48 border border-line p-3 text-left">
                  Produit
                </th>
                {products.map((product) => (
                  <th
                    key={product.id}
                    scope="col"
                    className="border border-line p-3 text-left align-top"
                    data-testid="compare-column"
                    data-slug={product.slug}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/images/product/${product.slug}`}
                      alt=""
                      width={120}
                      height={120}
                      className="mb-2 size-30 rounded bg-muted"
                    />
                    <p className="text-xs uppercase text-fg-muted">{product.brand}</p>
                    <Link href={`/p/${product.slug}`} className="font-semibold hover:text-amber-brand">
                      {product.name}
                    </Link>
                    <p className="mt-2">
                      <Link
                        href={`/comparateur?refs=${products
                          .filter((candidate) => candidate.slug !== product.slug)
                          .map((candidate) => candidate.slug)
                          .join(',')}`}
                        className="text-xs underline text-fg-muted"
                        data-testid="compare-remove"
                      >
                        Retirer
                      </Link>
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="border border-line p-3 text-left">
                  Prix
                </th>
                {products.map((product) => (
                  <td key={product.id} className="border border-line p-3">
                    <PriceTag
                      price={product.price}
                      listPrice={product.listPrice}
                      discountPct={product.discountPct}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border border-line p-3 text-left">
                  Note
                </th>
                {products.map((product) => (
                  <td key={product.id} className="border border-line p-3">
                    <Rating value={product.rating} count={product.reviewCount} />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border border-line p-3 text-left">
                  Disponibilité
                </th>
                {products.map((product) => (
                  <td key={product.id} className="border border-line p-3">
                    {product.stock > 0 ? 'En stock' : 'Rupture de stock'}
                  </td>
                ))}
              </tr>
              {specKeys.map((key) => (
                <tr key={key}>
                  <th scope="row" className="border border-line p-3 text-left">
                    {key}
                  </th>
                  {products.map((product) => (
                    <td key={product.id} className="border border-line p-3">
                      {product.specs[key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
