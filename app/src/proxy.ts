import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content Security Policy (CSP), with a per-request nonce.
 *
 * Until now the only directive served was `frame-ancestors 'none'`, set by
 * Caddy. It forbids framing, and nothing else: with neither `default-src` nor
 * `script-src`, an injected `<script>` tag ran unhindered. An audit flagged it.
 *
 * The nonce is a necessity, not a convenience: the header cannot be static
 * because this document contains an inline script — the theme bootstrap, which
 * must run in `<head>` before first paint to avoid the theme flash (see
 * lib/theme.ts). Pinning it with a `sha256-` would suit that one script, but
 * not the scripts Next injects for hydration, whose content changes with every
 * build.
 *
 * `strict-dynamic` does the rest: a script carrying the nonce passes its trust
 * on to the scripts it creates. That is what lets matomo.js install itself — it
 * is inserted through `document.createElement('script')` by the Matomo
 * bootstrap (components/analytics/Matomo.tsx) — without allow-listing its host,
 * and without a host allow-list becoming the usual bypass.
 *
 * This file is named `proxy.ts`, not `middleware.ts`: the convention was
 * renamed in Next 16, and the old name is deprecated.
 */

/**
 * Frozen at build time like everywhere else in this repository — `NEXT_PUBLIC_*`
 * is substituted by `next build`, here included. The expression is spelled out
 * in full for that reason: an indirect access would not be replaced.
 */
const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL;

/** Matomo's origin, or nothing when analytics is not configured. */
function matomoOrigin(): string {
  if (!MATOMO_URL) return '';
  try {
    return new URL(MATOMO_URL).origin;
  } catch {
    return '';
  }
}

function policy(nonce: string, chiffre: boolean): string {
  const matomo = matomoOrigin();
  const developpement = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    // `unsafe-eval` in development only: React uses it to rebuild server error
    // stacks in the browser. Neither React nor Next needs it in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developpement ? " 'unsafe-eval'" : ''}`,
    // `unsafe-inline` is deliberate for styles, and not out of convenience:
    // React sets `style=` attributes on elements, which `style-src-attr` can
    // only allow this way — a nonce only covers `<style>` tags. The directive
    // that matters against code injection is `script-src`, and that one is
    // strict.
    "style-src 'self' 'unsafe-inline'",
    // `data:` covers the SVGs generated on the fly by images/product/[slug].
    `img-src 'self' data: blob:${matomo ? ` ${matomo}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${matomo ? ` ${matomo}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Replaces X-Frame-Options, which cannot express anything other than
    // "never" or "same origin".
    "frame-ancestors 'none'",
    // Only on a document already served over TLS. On a plain-text origin the
    // directive has nothing to harden, but WebKit applies it to
    // `http://localhost` anyway where Chromium and Firefox exempt local
    // origins: `_next/static` chunks went out as `https://` to a port without
    // TLS, hydration never arrived, and the whole WebKit suite failed on
    // `waitForHydration()` without a single wrong assertion.
    ...(chiffre ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * The protocol as seen by the browser, not the one of the hop to the
 * application: in production Caddy terminates TLS and talks plain HTTP to the
 * container.
 */
function requeteChiffree(request: NextRequest): boolean {
  const transmis = request.headers.get('x-forwarded-proto');
  if (transmis) return transmis.split(',')[0].trim() === 'https';
  return request.nextUrl.protocol === 'https:';
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = policy(nonce, requeteChiffree(request));

  // The nonce travels in a request header: that is how the layout retrieves it
  // (`headers().get('x-nonce')`) to set it on the theme script and on the
  // Matomo bootstrap.
  const enTetes = new Headers(request.headers);
  enTetes.set('x-nonce', nonce);
  enTetes.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: enTetes } });
  response.headers.set('Content-Security-Policy', csp);

  // The shop uses none of these features. Denying them explicitly prevents a
  // third-party script added later from requesting them without anyone
  // noticing.
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  /**
   * Everything, except files served as-is.
   *
   * `_next/static` assets are immutable and cached by the browser as well as by
   * the proxy: routing them through this module would cost a recomputed nonce
   * for a header nobody reads on a file response. `_next/image` is excluded for
   * the same reason.
   */
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
