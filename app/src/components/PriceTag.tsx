import { formatPrice } from '@/lib/money';

export function PriceTag({
  price,
  listPrice,
  discountPct,
  size = 'md',
}: {
  price: number;
  listPrice: number | null;
  discountPct: number;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span
        className={size === 'lg' ? 'text-3xl font-bold' : 'text-lg font-bold'}
        data-testid="product-price"
      >
        {formatPrice(price)}
      </span>
      {listPrice !== null && (
        <>
          <span className="text-sm text-ink-500 line-through" data-testid="product-list-price">
            {formatPrice(listPrice)}
          </span>
          <span
            className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white"
            data-testid="product-discount"
          >
            -{discountPct}%
          </span>
        </>
      )}
    </div>
  );
}
