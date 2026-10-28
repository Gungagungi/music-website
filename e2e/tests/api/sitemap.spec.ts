import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@/fixtures/api-fixtures';
import { categoryListSchema } from '@/api/schemas';
import { CATALOG_TOTAL_PRODUCTS, CATEGORIES, PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * sitemap.xml.
 *
 * A sitemap fails silently: a missing product or a listed private page changes
 * nothing anyone sees in the shop, and only shows up weeks later in a search
 * console. The assertions therefore pin its contents against independent
 * sources — the catalogue total and the categories API — and fetch every URL it
 * lists, since a stale slug would point crawlers at a 404.
 */
async function sitemapUrls(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');
  const body = await response.text();
  expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc ?? '');
}

const NOINDEX = /<meta[^>]+name="robots"[^>]+noindex/;

test.describe('sitemap.xml', () => {
  test(
    'le plan du site liste l’accueil, chaque rayon, chaque guide et chaque produit',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-545', 'Plan du site — contenu'), covers('REQ-NAV-07')],
    },
    async ({ request, api, baseURL }) => {
      const urls = await sitemapUrls(request);
      const origin = new URL('/', baseURL).origin;
      const paths = urls.map((url) => {
        // Absolute and on the visited origin, like robots.txt's `Sitemap:`.
        expect(new URL(url).origin).toBe(origin);
        return new URL(url).pathname;
      });

      expect(new Set(paths).size).toBe(paths.length);
      expect(paths).toContain('/');
      expect(paths).toContain('/guides');
      expect(paths.filter((path) => path.startsWith('/guides/'))).not.toHaveLength(0);

      const { items } = await api.expectOk(await api.categories(), categoryListSchema);
      expect(paths.filter((path) => path.startsWith('/c/')).sort()).toEqual(
        items.map((category) => `/c/${category.slug}`).sort(),
      );
      expect(paths).toContain(`/c/${CATEGORIES.strings.slug}`);

      expect(paths.filter((path) => path.startsWith('/p/'))).toHaveLength(CATALOG_TOTAL_PRODUCTS);
      expect(paths).toContain(`/p/${PRODUCTS.inStock.slug}`);
    },
  );

  test(
    'le plan du site ne liste que des pages servies et indexables',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-546', 'Plan du site — pages indexables'), covers('REQ-NAV-07')],
    },
    async ({ request }) => {
      const urls = await sitemapUrls(request);
      const paths = urls.map((url) => new URL(url).pathname);

      // Disallowed in robots.txt (REQ-NAV-05) or `noindex` (REQ-NAV-06): listing
      // them would contradict the site's own instructions to crawlers.
      for (const excluded of ['/api', '/recherche', '/panier', '/commande', '/compte']) {
        expect(paths.filter((path) => path.startsWith(excluded)), excluded).toEqual([]);
      }

      for (const url of urls) {
        const response = await request.get(url, { maxRedirects: 0 });
        expect(response.status(), url).toBe(200);
        expect(await response.text(), url).not.toMatch(NOINDEX);
      }
    },
  );
});
