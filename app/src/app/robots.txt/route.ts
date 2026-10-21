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

export const dynamic = 'force-static';

export function GET() {
  return new Response(ROBOTS_TXT, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
