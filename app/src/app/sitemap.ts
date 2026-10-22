import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { CATEGORIES } from '@/data/categories';
import { GUIDES } from '@/data/guides';
import { listProductSlugs } from '@/lib/repositories/products';
import { publicOrigin } from '@/lib/site-origin';

/**
 * sitemap.xml: the pages a crawler should index, and only those.
 *
 * Home, departments, product pages and guides. Search is left out because
 * robots.txt disallows it, and the cart, checkout and account pages because
 * they carry `noindex` — a sitemap that lists a page the site asks not to index
 * is a contradiction search consoles report as an error. The comparator is left
 * out too: without a `refs` link it shows whatever the visitor collected, which
 * for a crawler is nothing.
 *
 * No `lastModified`. The catalogue has no modification date — `released_at` is
 * a launch date — and a timestamp taken at request time would claim every page
 * changed on every fetch, which is how a sitemap teaches crawlers to ignore it.
 *
 * Dynamic for two reasons: the origin comes from the request (see
 * lib/site-origin.ts), and products live in the database, which `next build`
 * does not have.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin(await headers());
  const productSlugs = await listProductSlugs();

  const paths = [
    '/',
    ...CATEGORIES.map((category) => `/c/${category.slug}`),
    '/guides',
    ...GUIDES.map((guide) => `/guides/${guide.slug}`),
    ...productSlugs.map((slug) => `/p/${slug}`),
  ];
  return paths.map((path) => ({ url: new URL(path, origin).href }));
}
