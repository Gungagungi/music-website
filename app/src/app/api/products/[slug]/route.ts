import { fail, ok } from '@/lib/api';
import { getProductBySlug, reviewsForProduct } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    return fail('NOT_FOUND', `Aucun produit ne correspond à la référence « ${slug} ».`);
  }
  return ok({ ...product, reviews: reviewsForProduct(product.id) });
}
