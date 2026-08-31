import { created, fail, ok } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { getProductBySlug } from '@/lib/catalog';
import { createAlert, deleteAlert } from '@/lib/repositories/stock-alerts';

export const dynamic = 'force-dynamic';

/**
 * Subscribes to, or cancels, a restock notice.
 *
 * Both verbs require an account: the alert belongs to whoever asked for it,
 * which is what makes it listable and cancellable without a token in a link.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour être alerté du retour en stock.');

  // Refused on an available product: the alert would fire on the next sweep,
  // which is not what "prévenez-moi quand il revient" means.
  if (product.stock > 0) {
    return fail('CONFLICT', 'Ce produit est déjà disponible.');
  }

  return created(await createAlert(product.id, user.id));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour gérer vos alertes.');

  if (!(await deleteAlert(product.id, user.id))) {
    return fail('NOT_FOUND', 'Aucune alerte à retirer sur ce produit.');
  }

  return ok({ removed: true });
}
