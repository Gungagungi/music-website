'use client';

import { useRouter } from 'next/navigation';

import { COMPARE_COOKIE } from '@/lib/compare';

/** Empties the comparison selection by expiring its cookie. */
export function ClearCompareButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      data-testid="compare-clear"
      className="text-sm underline text-fg-muted hover:text-amber-brand"
      onClick={() => {
        // `max-age=0` rather than writing an empty value: an empty cookie still
        // exists, and the bar would keep rendering itself out of it.
        document.cookie = `${COMPARE_COOKIE}=; path=/; max-age=0; samesite=lax`;
        router.refresh();
      }}
    >
      Tout retirer
    </button>
  );
}
