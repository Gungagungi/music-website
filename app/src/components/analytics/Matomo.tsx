import Script from 'next/script';
import { Suspense } from 'react';

import { SuiviDeNavigation } from './SuiviDeNavigation';

/**
 * Matomo instance address and site ID, both frozen at build time.
 *
 * `NEXT_PUBLIC_*` is not read at run time: Next replaces the expression with its
 * value during `next build`. Changing the URL or the siteId therefore requires
 * rebuilding the image (`docker compose up -d --build`), not restarting the
 * container — the same trap as NEXT_PUBLIC_SEED_BUGS. That is why the
 * expression is spelled out in full here: an indirect access
 * (`process.env[nom]`) would not be substituted and would always be undefined.
 */
const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL;
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;

/** Guarantees the single trailing slash matomo.js expects. */
function baseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Cookieless Matomo tracker.
 *
 * `disableCookies` before anything else: that is what makes a consent banner
 * unnecessary (IP anonymisation, for its part, is configured on the Matomo
 * server side, where the visitor cannot bypass it). The two settings go
 * together — enabling one without the other does not make the tracking exempt.
 *
 * The component renders nothing as long as the configuration is missing: a
 * local development setup has no Matomo instance behind it, and a request to an
 * unreachable host on every navigation would teach nobody anything.
 */
export function Matomo({ nonce }: { nonce?: string }) {
  if (!MATOMO_URL || !MATOMO_SITE_ID) return null;

  const base = baseUrl(MATOMO_URL);

  return (
    <>
      {/*
        The bootstrap PREPENDS itself to the queue instead of feeding it, and
        that is the whole point of this component.

        Two populations push into `_paq` without knowing about each other: this
        snippet, which carries the settings, and component effects, which carry
        page views and e-commerce events. No execution order can be guaranteed
        between the two — `afterInteractive` places the snippet after hydration,
        hence after the effects. A plain `push` would then leave
        `disableCookies` behind the first page view, and that view would be
        recorded with a cookie: the promise of no banner breaks on the first
        page of every visit.

        Prepending makes the question moot. The settings go ahead of whatever
        was already waiting, matomo.js drains the queue in order on arrival,
        and nobody has to know who ran first any more.

        Two other approaches were tried and discarded, each for a reason that
        only shows at run time. `beforeInteractive` is filed by Next into its
        `__next_s` queue and never runs in the App Router. An inline <script>
        tag rendered by React breaks hydration (`aB.apply is not a function`):
        the served HTML stays flawless, and the page loses all interactivity.

        No `trackPageView` here: SuiviDeNavigation emits it, for the first view
        as for the following ones.
      */}
      <Script id="matomo-init" strategy="afterInteractive" nonce={nonce}>
        {`
          (function() {
            var reglages = [
              ['disableCookies'],
              ['setTrackerUrl', ${JSON.stringify(`${base}matomo.php`)}],
              ['setSiteId', ${JSON.stringify(MATOMO_SITE_ID)}]
            ];
            window._paq = reglages.concat(window._paq || []);
            var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
            g.async = true; g.src = ${JSON.stringify(`${base}matomo.js`)};
            s.parentNode.insertBefore(g, s);
          })();
        `}
      </Script>

      <Suspense fallback={null}>
        <SuiviDeNavigation />
      </Suspense>
    </>
  );
}
