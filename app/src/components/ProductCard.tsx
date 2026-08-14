import Link from 'next/link';

import { PriceTag } from '@/components/PriceTag';
import { Rating } from '@/components/Rating';
import type { Product } from '@/lib/types';

export function ProductCard({ product }: { product: Product }) {
  const inStock = product.stock > 0;

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-lg border border-ink-100 bg-white transition hover:border-amber-brand hover:shadow-md"
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
          className="aspect-square w-full bg-ink-100 object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500" data-testid="product-brand">
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
            className={inStock ? 'text-xs font-semibold text-green-700' : 'text-xs font-semibold text-red-700'}
            data-testid="product-availability"
          >
            {inStock ? 'En stock' : 'Rupture de stock'}
          </p>
        </div>
      </div>
    </article>
  );
}
