import { getProductBySlug } from '@/lib/catalog';
import { parseCompareCookie } from '@/lib/compare';
import type { Product } from '@/lib/types';

/**
 * Resolves the comparison cookie into products.
 *
 * Unknown slugs are dropped rather than raised: the cookie survives a catalogue
 * change, and a product withdrawn from sale must narrow the selection instead
 * of breaking every page it is carried onto. The comparator page already takes
 * the same position for hand-edited URLs.
 *
 * An empty selection returns early and issues no query at all — this runs in the
 * root layout, on every request, and the common case is nothing selected.
 */
export async function comparedProducts(cookieValue: string | undefined): Promise<Product[]> {
  const slugs = parseCompareCookie(cookieValue);
  if (slugs.length === 0) return [];

  const products = await Promise.all(slugs.map((slug) => getProductBySlug(slug)));
  // Order is the order they were added in, which is what the bar shows and what
  // the comparator's columns follow.
  return products.filter((product): product is Product => Boolean(product));
}
