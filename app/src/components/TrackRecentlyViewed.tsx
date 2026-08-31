'use client';

import { useEffect } from 'react';

import {
  RECENTLY_VIEWED_COOKIE,
  parseRecentlyViewed,
  recordVisit,
  serialiseRecentlyViewed,
} from '@/lib/recently-viewed';

/**
 * Records the visit in the recently-viewed cookie.
 *
 * Written from the client rather than during the render: a server component
 * cannot set a cookie while rendering, and doing it in middleware would make
 * every request to every route pay for a feature that only concerns product
 * pages.
 *
 * It deliberately does **not** call `router.refresh()`. The block it feeds is
 * rendered from the cookie as it was when the page was requested, so the
 * product you are looking at appears in "vus récemment" on the *next* page —
 * which is what the phrase means. Refreshing would re-render the current page
 * to list the product you are already on.
 */
export function TrackRecentlyViewed({ slug }: { slug: string }) {
  useEffect(() => {
    const current = parseRecentlyViewed(
      document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${RECENTLY_VIEWED_COOKIE}=`))
        ?.slice(RECENTLY_VIEWED_COOKIE.length + 1),
    );

    const next = serialiseRecentlyViewed(recordVisit(current, slug));
    document.cookie = `${RECENTLY_VIEWED_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [slug]);

  return null;
}
