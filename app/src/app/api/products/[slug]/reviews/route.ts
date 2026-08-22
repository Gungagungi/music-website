import { randomUUID } from 'node:crypto';

import { created, enforceRateLimit, fail, ok, parseBody } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { getProductBySlug, reviewsForProduct } from '@/lib/catalog';
import { createReview, hasReviewed } from '@/lib/repositories/reviews';
import { createReviewSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');
  return ok({ items: await reviewsForProduct(product.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const limited = enforceRateLimit('review', request);
  if (limited) return limited;

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour publier un avis.');

  const parsed = await parseBody(request, createReviewSchema);
  if (!parsed.ok) return parsed.response;

  if (await hasReviewed(product.id, user.id)) {
    return fail('CONFLICT', 'Vous avez déjà publié un avis sur ce produit.');
  }

  // Insertion and the product's denormalised aggregates move together, in one
  // transaction — see createReview().
  const review = await createReview({
    id: randomUUID(),
    productId: product.id,
    userId: user.id,
    author: `${user.firstName} ${user.lastName.charAt(0)}.`,
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  return created(review);
}
