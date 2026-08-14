import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddToCartForm } from '@/components/AddToCartForm';
import { Breadcrumb } from '@/components/Breadcrumb';
import { PriceTag } from '@/components/PriceTag';
import { ProductGrid } from '@/components/ProductGrid';
import { Rating } from '@/components/Rating';
import { CATEGORY_BY_SLUG } from '@/data/categories';
import { getProductBySlug, queryProducts, reviewsForProduct } from '@/lib/catalog';
import { formatPrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return {
    title: product ? `${product.brand} ${product.name}` : 'Produit introuvable',
    description: product?.description,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const category = CATEGORY_BY_SLUG.get(product.category);
  const reviews = reviewsForProduct(product.id);
  const related = queryProducts({ category: product.category, limit: 5 }).items
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8" data-testid="product-page" data-sku={product.sku}>
      <Breadcrumb
        trail={[
          { label: 'Accueil', href: '/' },
          { label: category?.label ?? product.category, href: `/c/${product.category}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/product/${product.slug}`}
              alt={`${product.brand} ${product.name}`}
              width={400}
              height={400}
              className="w-full rounded-lg border border-ink-100 bg-white"
              data-testid="product-image"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                {product.brand}
              </p>
              <h1 className="mt-1 text-3xl font-bold" data-testid="product-title">
                {product.name}
              </h1>
              <p className="mt-2 text-sm text-ink-500" data-testid="product-sku">
                Réf. {product.sku}
              </p>
              <div className="mt-3">
                <Rating value={product.rating} count={product.reviewCount} />
              </div>
              <p className="mt-4 leading-relaxed" data-testid="product-description">
                {product.description}
              </p>
            </div>
          </div>

          <section className="mt-10" aria-labelledby="specs-title">
            <h2 id="specs-title" className="text-xl font-bold">
              Caractéristiques
            </h2>
            <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="product-specs">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-ink-100 py-2">
                  <dt className="text-sm text-ink-500">{key}</dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="text-xl font-bold">
              Avis clients
            </h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-ink-500" data-testid="no-reviews">
                Aucun avis pour le moment. Soyez le premier à donner le vôtre.
              </p>
            ) : (
              <ul className="mt-4 space-y-4" data-testid="review-list" data-count={reviews.length}>
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-ink-100 bg-white p-4"
                    data-testid="review-item"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{review.title}</h3>
                      <Rating value={review.rating} count={1} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{review.body}</p>
                    <p className="mt-2 text-xs text-ink-500">
                      {review.author} ·{' '}
                      {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-ink-100 bg-white p-6 lg:sticky lg:top-6">
          <PriceTag
            price={product.price}
            listPrice={product.listPrice}
            discountPct={product.discountPct}
            size="lg"
          />

          <p className="mt-1 text-xs text-ink-500">TVA incluse</p>

          <p
            className={
              product.stock > 0
                ? 'mt-4 text-sm font-semibold text-green-700'
                : 'mt-4 text-sm font-semibold text-red-700'
            }
            data-testid="product-availability"
            data-stock={product.stock}
          >
            {product.stock > 0 ? `En stock — ${product.stock} disponible(s)` : 'Rupture de stock'}
          </p>

          {product.leftHanded && (
            <p className="mt-2 inline-block rounded bg-ink-100 px-2 py-1 text-xs font-semibold" data-testid="left-handed-badge">
              Modèle gaucher
            </p>
          )}

          <div className="mt-6">
            <AddToCartForm product={product} />
          </div>

          <ul className="mt-6 space-y-1 text-xs text-ink-500">
            <li>Livraison offerte dès {formatPrice(19900)}</li>
            <li>Retour sous 30 jours</li>
            <li>Garantie 3 ans</li>
          </ul>

          <Link
            href={`/comparateur?refs=${product.slug}`}
            className="mt-4 inline-block text-sm underline hover:text-amber-brand"
            data-testid="add-to-compare"
          >
            Comparer ce produit
          </Link>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related-title">
          <h2 id="related-title" className="text-2xl font-bold">
            Dans le même rayon
          </h2>
          <div className="mt-4">
            <ProductGrid products={related} testId="related-products" />
          </div>
        </section>
      )}
    </div>
  );
}
