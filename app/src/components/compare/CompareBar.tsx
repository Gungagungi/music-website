import Link from 'next/link';

import { ClearCompareButton } from '@/components/compare/ClearCompareButton';
import { MAX_COMPARED } from '@/lib/compare';
import type { Product } from '@/lib/types';

/**
 * The selection, shown as a bar pinned to the bottom of every page.
 *
 * Rendered on the server from the cookie, so it is in the served HTML: no jump
 * after hydration, and a spec can assert on it without waiting for anything.
 * When nothing is selected the bar is *absent*, not hidden — an empty bar would
 * take up screen space on every page to say nothing, and it would also land in
 * every visual baseline.
 */
export function CompareBar({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  const refs = products.map((product) => product.slug).join(',');

  return (
    <div
      className="sticky bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
      data-testid="compare-bar"
      data-count={products.length}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <p className="text-sm font-semibold">
          Comparateur ({products.length}/{MAX_COMPARED})
        </p>

        <ul className="flex flex-1 flex-wrap items-center gap-3">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-2" data-testid="compare-bar-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/product/${product.slug}`}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded bg-muted"
              />
              <span className="text-xs">{product.name}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <ClearCompareButton />
          <Link
            href={`/comparateur?refs=${refs}`}
            className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
            data-testid="compare-open"
          >
            Comparer
          </Link>
        </div>
      </div>
    </div>
  );
}
