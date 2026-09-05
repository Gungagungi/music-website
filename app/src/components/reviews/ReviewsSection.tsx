import Link from 'next/link';

import { Pagination } from '@/components/Pagination';
import { Rating } from '@/components/Rating';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewSortSelect } from '@/components/reviews/ReviewSortSelect';
import type { Product, RatingHistogram, ReviewPage } from '@/lib/types';

/**
 * The reviews block of a product page.
 *
 * Sort, star filter and pagination all live in the URL rather than in component
 * state, and the whole block is server-rendered from it. That is what makes a
 * filtered page shareable, reloadable and — for the suite — assertable without
 * waiting on a client transition.
 *
 * Query keys are prefixed `avis-` because this block shares its URL with the
 * rest of the product page; a bare `page` would collide the day the related
 * products get paginated.
 */

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

function href(slug: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  // The anchor keeps the reader where they were reading: without it, every
  // filter click jumps back to the top of a long product page.
  return `/p/${slug}${query ? `?${query}` : ''}#avis`;
}

export function ReviewsSection({
  product,
  page,
  sort,
  rating,
  canReview,
}: {
  product: Product;
  page: ReviewPage;
  sort: string;
  rating?: number;
  canReview: boolean;
}) {
  const buildHref = (target: number) =>
    href(product.slug, {
      'avis-tri': sort === 'recents' ? undefined : sort,
      'avis-note': rating,
      'avis-page': target === 1 ? undefined : target,
    });

  return (
    <section className="mt-10 scroll-mt-6" id="avis" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-xl font-bold">
        Avis clients
      </h2>

      {/* The star rating aggregates the product's whole history; only the most
          recent reviews are kept in full. Saying so is what keeps the two
          figures from reading as a contradiction. */}
      <p className="mt-1 text-sm text-fg-muted" data-testid="reviews-summary">
        Note moyenne {product.rating.toFixed(1)}/5 sur {product.reviewCount} avis ·{' '}
        {page.storedCount} avis détaillé{page.storedCount > 1 ? 's' : ''}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <Histogram
          slug={product.slug}
          histogram={page.histogram}
          storedCount={page.storedCount}
          active={rating}
          sort={sort}
        />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted" data-testid="reviews-count">
              {page.total} avis affiché{page.total > 1 ? 's' : ''}
              {rating !== undefined ? ` · filtre ${rating} étoile${rating > 1 ? 's' : ''}` : ''}
            </p>
            <ReviewSortSelect />
          </div>

          {page.items.length === 0 ? (
            <p className="mt-4 text-fg-muted" data-testid="no-reviews">
              {rating === undefined
                ? 'Aucun avis pour le moment. Soyez le premier à donner le vôtre.'
                : 'Aucun avis pour cette note.'}
            </p>
          ) : (
            <ul
              className="mt-4 space-y-4"
              data-testid="review-list"
              data-count={page.items.length}
            >
              {page.items.map((review) => (
                <li
                  key={review.id}
                  className="rounded-lg border border-line bg-surface p-4"
                  data-testid="review-item"
                  data-rating={review.rating}
                  data-verified={review.verifiedPurchase ? 'true' : 'false'}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{review.title}</h3>
                    <Rating value={review.rating} count={1} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{review.body}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span>{review.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    {review.verifiedPurchase && (
                      <span
                        className="rounded bg-muted px-2 py-0.5 font-semibold text-success"
                        data-testid="verified-badge"
                      >
                        Achat vérifié
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Pagination page={page.page} totalPages={page.totalPages} buildHref={buildHref} />

          <ReviewForm slug={product.slug} canReview={canReview} />
        </div>
      </div>
    </section>
  );
}

/**
 * Bar chart of the stored reviews, each bar a filter link.
 *
 * The bars are sized against the tallest level rather than against the total:
 * a product whose reviews are all five stars would otherwise draw one full bar
 * and four invisible ones, which is the same picture as no data at all.
 */
function Histogram({
  slug,
  histogram,
  storedCount,
  active,
  sort,
}: {
  slug: string;
  histogram: RatingHistogram;
  storedCount: number;
  active?: number;
  sort: string;
}) {
  const tallest = Math.max(...STAR_LEVELS.map((level) => histogram[level]), 1);

  return (
    <div className="h-fit rounded-lg border border-line bg-surface p-4" data-testid="review-histogram">
      <h3 className="text-sm font-semibold">Répartition des notes</h3>

      <ul className="mt-3 space-y-2">
        {STAR_LEVELS.map((level) => {
          const value = histogram[level];
          const share = storedCount === 0 ? 0 : Math.round((value / storedCount) * 100);
          const isActive = active === level;

          return (
            <li key={level}>
              <Link
                href={href(slug, {
                  'avis-tri': sort === 'recents' ? undefined : sort,
                  // Clicking the active level clears the filter, so the control
                  // that applied it is also the one that undoes it.
                  'avis-note': isActive ? undefined : level,
                })}
                // `aria-current`, not `aria-pressed`: these are links, and a
                // link's role does not support a pressed state — the axe scan
                // reports it as a critical violation, rightly.
                aria-current={isActive ? true : undefined}
                aria-label={`${value} avis à ${level} étoile${level > 1 ? 's' : ''} (${share} %)`}
                data-testid={`histogram-bar-${level}`}
                data-count={value}
                data-active={isActive ? 'true' : 'false'}
                className={
                  isActive
                    ? 'flex items-center gap-2 rounded px-1 py-0.5 outline outline-2 outline-amber-brand'
                    : 'flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted'
                }
              >
                <span className="w-10 shrink-0 text-xs text-fg-muted" aria-hidden="true">
                  {level} ★
                </span>
                <span
                  className="h-2 flex-1 overflow-hidden rounded bg-muted"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded bg-amber-brand"
                    style={{ width: `${Math.round((value / tallest) * 100)}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums" aria-hidden="true">
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {active !== undefined && (
        <Link
          href={href(slug, { 'avis-tri': sort === 'recents' ? undefined : sort })}
          className="mt-3 inline-block text-xs underline hover:text-amber-brand"
          data-testid="histogram-reset"
        >
          Voir toutes les notes
        </Link>
      )}
    </div>
  );
}
