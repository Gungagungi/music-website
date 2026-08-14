import { created, fail, ok, parseBody } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { getProductBySlug, reviewsForProduct } from '@/lib/catalog';
import { getDb, newId } from '@/lib/db';
import { createReviewSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');
  return ok({ items: reviewsForProduct(product.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour publier un avis.');

  const parsed = await parseBody(request, createReviewSchema);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const alreadyReviewed = db.reviews.some(
    (review) => review.productId === product.id && review.userId === user.id,
  );
  if (alreadyReviewed) {
    return fail('CONFLICT', 'Vous avez déjà publié un avis sur ce produit.');
  }

  const review = {
    id: newId(),
    productId: product.id,
    userId: user.id,
    author: `${user.firstName} ${user.lastName.charAt(0)}.`,
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
    createdAt: new Date().toISOString(),
  };
  db.reviews.push(review);

  // The catalog carries denormalised aggregates, so they have to be refreshed
  // alongside the write — a classic source of "the list says 4.2, the page says
  // 4.3" defects worth having a regression test for.
  const all = reviewsForProduct(product.id);
  product.reviewCount = all.length;
  product.rating = Math.round((all.reduce((sum, item) => sum + item.rating, 0) / all.length) * 10) / 10;

  return created(review);
}
