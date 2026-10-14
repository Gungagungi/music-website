'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  COMPARE_COOKIE,
  MAX_COMPARED,
  isCompareFull,
  parseCompareCookie,
  serialiseCompareCookie,
  toggleCompared,
} from '@/lib/compare';

/**
 * Adds or removes a product from the comparison selection.
 *
 * The same control does both, so a mis-click is undone where it was made.
 *
 * The state is read from `document.cookie` at click time rather than held in
 * React: the same product can be on screen twice (a card in the grid and the
 * comparison bar), and two components holding their own copy would disagree the
 * moment one of them acted. The cookie is the single source, and
 * `router.refresh()` re-renders every server component that reads it.
 *
 * `selected` comes from the server, which is what keeps the label correct on
 * first paint — no flash of the wrong wording while hydration catches up.
 */
export function CompareToggle({
  slug,
  selected,
  variant = 'link',
}: {
  slug: string;
  selected: boolean;
  variant?: 'link' | 'button';
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');

  function onClick() {
    const current = parseCompareCookie(
      document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${COMPARE_COOKIE}=`))
        ?.slice(COMPARE_COOKIE.length + 1),
    );

    if (isCompareFull(current, slug)) {
      setMessage(`Comparaison limitée à ${MAX_COMPARED} produits.`);
      return;
    }

    const next = toggleCompared(current, slug);
    // `max-age` in seconds, thirty days — the selection is a browsing-session
    // convenience, not something to keep for a year. `SameSite=Lax` because the
    // comparator is reached by ordinary navigation.
    document.cookie = `${COMPARE_COOKIE}=${serialiseCompareCookie(next)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    setMessage('');
    router.refresh();
  }

  const label = selected ? 'Retirer du comparateur' : 'Comparer ce produit';

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        data-testid="compare-toggle"
        data-selected={selected ? 'true' : 'false'}
        data-slug={slug}
        className={
          variant === 'button'
            ? 'w-full rounded-md border border-line-strong px-4 py-2 text-sm font-semibold hover:border-amber-brand'
            : 'text-left text-xs underline text-fg-muted hover:text-amber-brand'
        }
      >
        {label}
      </button>

      {/* Only rendered once it has something to say: an always-present live
          region on every card would be announced as empty content by some
          screen readers. */}
      {message && (
        <p role="status" className="mt-1 text-xs text-danger" data-testid="compare-limit">
          {message}
        </p>
      )}
    </>
  );
}
