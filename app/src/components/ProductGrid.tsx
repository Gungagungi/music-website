import { ProductCard } from '@/components/ProductCard';
import type { Product } from '@/lib/types';

export function ProductGrid({ products, testId = 'product-grid' }: { products: Product[]; testId?: string }) {
  return (
    <ul
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      data-testid={testId}
      data-count={products.length}
    >
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
