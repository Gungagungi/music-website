import { publicOrigin } from '@/lib/site-origin';

/**
 * robots.txt, written by hand rather than through `app/robots.ts`.
 *
 * Next's metadata route only emits directives, and the one thing this file
 * must say is not a directive: that Fretline is a fictional shop. Crawlers are
 * welcome — the site is a public portfolio — but whoever reads this file, an
 * indexer's operator or a dataset builder, must not mistake the catalogue,
 * prices and stock levels for real offers. Comments are the only place the
 * format leaves for that, so the body is served verbatim.
 *
 * Disallowed paths are the ones with nothing to fetch: the API, and search,
 * whose query space is unbounded. The cart, checkout and account area are left
 * crawlable on purpose: they carry `noindex`, and a disallowed page is one whose
 * `noindex` is never read — a URL linked from elsewhere then stays indexed,
 * snippet-less. The catalogue, product pages and guides stay open.
 *
 * Pre-production serves this same file. Its `X-Robots-Tag: noindex` header
 * (Caddyfile) is what keeps it out of search results, and a `Disallow: /` here
 * would defeat it: a crawler that may not fetch a page never sees its header.
 *
 * The one computed line is `Sitemap:`, which the format requires to be an
 * absolute URL. Its origin comes from the request (lib/site-origin.ts), so
 * pre-production points at its own sitemap rather than production's — and the
 * route is dynamic instead of being frozen at build time with no host to read.
 */
export const ROBOTS_TXT = `# Fretline is a fictional shop: a QA automation portfolio project.
# Nothing here is for sale. Products, prices, stock levels, reviews and
# accounts are generated test data, not real offers.
#
# Fretline est une boutique fictive : un projet de portfolio QA.
# Rien n'y est à vendre. Produits, prix, stocks, avis et comptes sont des
# données de test générées, pas de véritables offres.

User-agent: *
Allow: /
Disallow: /api/
Disallow: /recherche
`;

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const sitemap = new URL('/sitemap.xml', publicOrigin(request.headers)).href;
  return new Response(`${ROBOTS_TXT}\nSitemap: ${sitemap}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
