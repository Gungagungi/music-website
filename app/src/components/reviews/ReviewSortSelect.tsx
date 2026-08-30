'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { REVIEW_SORT_OPTIONS } from '@/lib/search-params';

/**
 * Sort control for the reviews block.
 *
 * Same shape as the catalogue's `SortSelect`, but writing `avis-tri` and
 * resetting `avis-page`: changing the order makes the current page number
 * meaningless, and keeping it lands the reader on page 4 of a re-ordered list.
 * The hash sends them back to the block rather than to the top of the page.
 */
export function ReviewSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="review-sort" className="text-sm text-fg-muted">
        Trier les avis
      </label>
      <select
        id="review-sort"
        data-testid="review-sort"
        className="rounded border border-line bg-surface px-2 py-2 text-sm"
        value={searchParams.get('avis-tri') ?? 'recents'}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === 'recents') params.delete('avis-tri');
          else params.set('avis-tri', event.target.value);
          params.delete('avis-page');
          router.push(`${pathname}${params.toString() ? `?${params}` : ''}#avis`);
        }}
      >
        {REVIEW_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
