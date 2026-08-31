import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { AddToCartForm } from '@/components/AddToCartForm';
import { Breadcrumb } from '@/components/Breadcrumb';
import { PriceTag } from '@/components/PriceTag';
import { ProductGrid } from '@/components/ProductGrid';
import { Rating } from '@/components/Rating';
import { ProductTabs, parseProductTab } from '@/components/ProductTabs';
import { StockAlertForm } from '@/components/StockAlertForm';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrackProductView } from '@/components/analytics/TrackProductView';
import { CATEGORY_BY_SLUG } from '@/data/categories';
import { availabilityFor } from '@/lib/availability';
import { COMPARE_COOKIE, parseCompareCookie } from '@/lib/compare';
import { hasAlert } from '@/lib/repositories/stock-alerts';
import { accessoriesFor, boughtTogetherWith } from '@/lib/repositories/suggestions';
import { currentUser } from '@/lib/auth';
import { getProductBySlug, queryProducts, reviewPage } from '@/lib/catalog';
import { formatPrice } from '@/lib/money';
import { parseReviewParams } from '@/lib/search-params';
import type { RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product ? `${product.brand} ${product.name}` : 'Produit introuvable',
    description: product?.description,
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const search = await searchParams;
  const reviewQuery = parseReviewParams(search);
  const tab = parseProductTab(search.onglet);
  const availability = availabilityFor(product.stock);
  const comparedSlugs = parseCompareCookie((await cookies()).get(COMPARE_COOKIE)?.value);
  const category = CATEGORY_BY_SLUG.get(product.category);
  const [reviews, sameCategory, user, accessories, boughtTogether] = await Promise.all([
    reviewPage(product.id, reviewQuery),
    queryProducts({ category: product.category, limit: 5 }),
    currentUser(),
    accessoriesFor(product),
    boughtTogetherWith(product.id),
  ]);

  // Only asked when it can matter: an available product shows no alert control,
  // so there is nothing to reflect.
  const subscribedToRestock =
    user && product.stock <= 0 ? await hasAlert(product.id, user.id) : false;
  // Five fetched to keep four after dropping the product being viewed.
  const related = sameCategory.items
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8" data-testid="product-page" data-sku={product.sku}>
      {/* Inerte sans tracker : les commandes empilées vers un `_paq` absent sont
          ignorées (lib/analytics.ts). */}
      <TrackProductView
        sku={product.sku}
        name={`${product.brand} ${product.name}`}
        category={category?.label ?? product.category}
        price={product.price}
      />

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
              className="w-full rounded-lg border border-line bg-surface"
              data-testid="product-image"
            />

            <div data-testid="product-identity">
              <p
                className="text-sm font-semibold uppercase tracking-wide text-fg-muted"
                data-testid="product-brand"
              >
                {product.brand}
              </p>
              <h1 className="mt-1 text-3xl font-bold" data-testid="product-title">
                {product.name}
              </h1>
              <p className="mt-2 text-sm text-fg-muted" data-testid="product-sku">
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

          <ProductTabs
            slug={product.slug}
            active={tab}
            specs={product.specs}
            accessories={accessories}
          />

          <ReviewsSection
            product={product}
            page={reviews}
            sort={reviewQuery.sort}
            rating={reviewQuery.rating}
            canReview={Boolean(user)}
          />

        </div>

        {/* The buy box carries its own test id: prices and availability labels
            also appear on the related-product cards further down the page. */}
        <aside
          className="h-fit rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-6"
          data-testid="product-buybox"
        >
          <PriceTag
            price={product.price}
            listPrice={product.listPrice}
            discountPct={product.discountPct}
            size="lg"
          />

          <p className="mt-1 text-xs text-fg-muted">TVA incluse</p>

          {/* Two lines, not one: whether it can be had, and when. The second is
              what a customer actually decides on, and a bare "En stock" said
              nothing about waiting three weeks for a back-ordered instrument.
              Both are pure functions of the stock level — no date is computed,
              or the buy box would drift every night and take the visual
              baseline with it. */}
          <p
            className={
              availability.orderable
                ? 'mt-4 text-sm font-semibold text-success'
                : 'mt-4 text-sm font-semibold text-danger'
            }
            data-testid="product-availability"
            data-stock={product.stock}
            data-availability={availability.level}
          >
            {availability.orderable
              ? `${availability.label} — ${product.stock} disponible(s)`
              : availability.label}
          </p>

          <p className="mt-1 text-sm text-fg-muted" data-testid="product-shipping">
            {availability.shipping}
          </p>

          {product.leftHanded && (
            <p className="mt-2 inline-block rounded bg-muted px-2 py-1 text-xs font-semibold" data-testid="left-handed-badge">
              Modèle gaucher
            </p>
          )}

          <div className="mt-6">
            <AddToCartForm product={product} />
          </div>

          {/* Only on an unavailable product: on an available one the alert
              would fire on the very next sweep, which is not what "prévenez-moi
              quand il revient" asks for. The API refuses it too. */}
          {!availability.orderable && (
            <StockAlertForm
              slug={product.slug}
              subscribed={subscribedToRestock}
              canSubscribe={Boolean(user)}
            />
          )}

          <ul className="mt-6 space-y-1 text-xs text-fg-muted">
            <li>Livraison offerte dès {formatPrice(19900)}</li>
            <li>Retour sous 30 jours</li>
            <li>Garantie 3 ans</li>
          </ul>

          <div className="mt-4">
            <CompareToggle
              slug={product.slug}
              selected={comparedSlugs.includes(product.slug)}
              variant="button"
            />
          </div>
        </aside>
      </div>

      {boughtTogether.length > 0 && (
        <section className="mt-14" aria-labelledby="bought-together-title">
          <h2 id="bought-together-title" className="text-2xl font-bold">
            Souvent acheté avec
          </h2>
          {/* Read from the orders that actually contain this product, so the
              section says something true or is not rendered at all. */}
          <div className="mt-4">
            <ProductGrid products={boughtTogether} testId="bought-together" />
          </div>
        </section>
      )}

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
