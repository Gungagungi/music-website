import { fail, ok, parseBody } from '@/lib/api';
import { MAX_QUANTITY_PER_LINE, removeItem, updateItemQuantity } from '@/lib/cart';
import { resolveCart } from '@/lib/cart-session';
import { updateItemSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const parsed = await parseBody(request, updateItemSchema);
  if (!parsed.ok) return parsed.response;

  const cart = await resolveCart(request);
  const result = await updateItemQuantity(cart, itemId, parsed.data.quantity);

  if (!result.ok) {
    if (result.reason === 'out_of_stock') return fail('OUT_OF_STOCK', 'Stock insuffisant.');
    if (result.reason === 'max_quantity') {
      return fail('MAX_QUANTITY', `Quantité maximale de ${MAX_QUANTITY_PER_LINE} articles par ligne.`);
    }
    return fail('NOT_FOUND', 'Ligne de panier introuvable.');
  }

  return ok(result.cart);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const cart = await resolveCart(request);
  const result = await removeItem(cart, itemId);
  if (!result.ok) return fail('NOT_FOUND', 'Ligne de panier introuvable.');
  return ok(result.cart);
}
