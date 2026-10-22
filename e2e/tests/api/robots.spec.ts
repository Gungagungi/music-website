import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@/fixtures/api-fixtures';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * robots.txt.
 *
 * Crawlers are allowed in, so the file's job is twofold: say that the shop is
 * fictional, and keep crawlers out of the routes with nothing to index. The
 * statement is asserted in both languages — a crawler's operator may read
 * either, and dropping one would go unnoticed in review.
 */
async function robots(request: APIRequestContext) {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  return response.text();
}

/** `Disallow` values of the `User-agent: *` group, the only group served. */
function disallowed(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith('disallow:'))
    .map((line) => line.slice('disallow:'.length).trim());
}

test.describe('robots.txt', () => {
  test(
    'robots.txt annonce que la boutique est fictive',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-530', 'robots.txt — boutique fictive'), covers('REQ-NAV-05')],
    },
    async ({ request }) => {
      const body = await robots(request);

      expect(body).toContain('Fretline is a fictional shop');
      expect(body).toContain('Fretline est une boutique fictive');
    },
  );

  test(
    'robots.txt ouvre le catalogue et ferme les espaces sans contenu à indexer',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-531', 'robots.txt — chemins exclus'), covers('REQ-NAV-05')],
    },
    async ({ request }) => {
      const body = await robots(request);

      expect(body).toMatch(/^User-agent: \*$/m);
      // A bare `Disallow: /` would close the whole site, the catalogue included.
      expect(disallowed(body)).not.toContain('/');
      // The private pages are not listed: barred, their `noindex` would go
      // unread (REQ-NAV-06).
      expect(disallowed(body).sort()).toEqual(['/api/', '/recherche'].sort());
    },
  );

  test(
    'robots.txt annonce le plan du site sur l’origine visitée',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-544', 'robots.txt — plan du site'), covers('REQ-NAV-07')],
    },
    async ({ request, baseURL }) => {
      const body = await robots(request);

      // Absolute, as the format requires, and on the origin the suite is
      // visiting: pre-production must not send crawlers to production's map.
      const sitemaps = body.match(/^Sitemap: .*$/gm) ?? [];
      expect(sitemaps).toEqual([`Sitemap: ${new URL('/sitemap.xml', baseURL).href}`]);
    },
  );
});
