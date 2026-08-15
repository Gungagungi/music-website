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

  // The catalog carries denormalised aggregates covering the product's whole
  // review history, of which only the most recent are stored individually.
  // Recomputing from the stored rows alone would wipe that history — a rating
  // of 4.3 over 183 reviews would collapse to whatever the newest reviewer
  // typed. The aggregate is therefore updated incrementally.
  const previousTotal = product.rating * product.reviewCount;
  product.reviewCount += 1;
  product.rating = Math.round(((previousTotal + parsed.data.rating) / product.reviewCount) * 10) / 10;

  return created(review);
}
