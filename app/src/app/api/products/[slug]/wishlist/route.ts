import { created, fail, ok } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { getProductBySlug } from '@/lib/catalog';
import { addToWishlist, removeFromWishlist } from '@/lib/repositories/wishlist';

export const dynamic = 'force-dynamic';

/** Saves a product to the customer's wish list, or removes it. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour enregistrer vos favoris.');

  // No stock condition, unlike a restock alert: a wish list is about wanting
  // the thing, not about whether it happens to be on the shelf today.
  await addToWishlist(product.id, user.id);

  return created({ saved: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour gérer vos favoris.');

  if (!(await removeFromWishlist(product.id, user.id))) {
    return fail('NOT_FOUND', 'Ce produit n’est pas dans vos favoris.');
  }

  return ok({ removed: true });
}
