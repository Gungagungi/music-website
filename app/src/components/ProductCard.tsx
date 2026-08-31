import { cookies } from 'next/headers';
import Link from 'next/link';

import { PriceTag } from '@/components/PriceTag';
import { Rating } from '@/components/Rating';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { availabilityFor } from '@/lib/availability';
import { COMPARE_COOKIE, parseCompareCookie } from '@/lib/compare';
import type { Product } from '@/lib/types';

/**
 * The card reads the comparison cookie itself rather than receiving it as a
 * prop. Threading it down would mean touching the grid and each of the four
 * pages that render one, and every one of them would be free to forget.
 * Reading it here costs nothing — the layout already reads the same cookie on
 * every request, and these pages are dynamic regardless.
 */
export async function ProductCard({ product }: { product: Product }) {
  const availability = availabilityFor(product.stock);
  const compared = parseCompareCookie((await cookies()).get(COMPARE_COOKIE)?.value);

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:border-amber-brand hover:shadow-md"
      data-testid="product-card"
      data-sku={product.sku}
      data-slug={product.slug}
      data-price={product.price}
    >
      <Link href={`/p/${product.slug}`} className="block" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/images/product/${product.slug}`}
          alt=""
          width={400}
          height={400}
          loading="lazy"
          className="aspect-square w-full bg-muted object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted" data-testid="product-brand">
          {product.brand}
        </p>

        <h3 className="text-sm font-semibold leading-snug">
          <Link href={`/p/${product.slug}`} className="hover:text-amber-brand" data-testid="product-name">
            {product.name}
          </Link>
        </h3>

        <Rating value={product.rating} count={product.reviewCount} />

        <div className="mt-auto space-y-2 pt-2">
          <PriceTag
            price={product.price}
            listPrice={product.listPrice}
            discountPct={product.discountPct}
          />
          <p
            className={
              availability.orderable
                ? 'text-xs font-semibold text-success'
                : 'text-xs font-semibold text-danger'
            }
            data-testid="product-availability"
            data-availability={availability.level}
          >
            {availability.label}
          </p>

          <CompareToggle slug={product.slug} selected={compared.includes(product.slug)} />
        </div>
      </div>
    </article>
  );
}
