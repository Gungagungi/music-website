'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { push } from '@/lib/analytics';

/**
 * Emits the page view, on entering the site as on every navigation.
 *
 * Next does not reload the page from one route to the next: without this
 * component, Matomo would only record the session's very first view.
 *
 * The first view belongs to it too, and not to the bootstrap snippet, because
 * of e-commerce. `setEcommerceView` records nothing by itself: it arms the
 * *next* page view. The product declaration must therefore come before the view
 * is emitted, otherwise the product page counts as an ordinary page. React runs
 * children's effects before their parents', and `{children}` comes before
 * `<Matomo />` in the layout: TrackProductView's effect runs before this one,
 * which gives the intended order without explicit coordination. Should that
 * order change, the degradation is benign — a page view without its e-commerce
 * part, never a duplicate.
 *
 * `useSearchParams` is what requires the parent component's `<Suspense>`:
 * without it, any page rendering this component switches to dynamic rendering.
 */
export function SuiviDeNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const precedente = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    // On entering the site, the tracker reads the document's URL and referrer
    // by itself. Rewriting them would add nothing and would replace an external
    // referrer — the one that says where the visitor came from — with a page of
    // the site.
    if (precedente.current !== null) {
      push(['setReferrerUrl', new URL(precedente.current, window.location.origin).href]);
      push(['setCustomUrl', window.location.href]);
      push(['setDocumentTitle', document.title]);
    }

    push(['trackPageView']);
    // Outbound links and downloads are re-attached on every view: the DOM has
    // been replaced, and the listeners set on the old one are gone.
    push(['enableLinkTracking']);

    precedente.current = url;
  }, [pathname, searchParams]);

  return null;
}
