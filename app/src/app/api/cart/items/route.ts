import { created, fail, parseBody } from '@/lib/api';
import { MAX_QUANTITY_PER_LINE, addItem } from '@/lib/cart';
import { resolveCartForWrite } from '@/lib/cart-session';
import { getProductById, getProductBySku } from '@/lib/catalog';
import { addItemSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseBody(request, addItemSchema);
  if (!parsed.ok) return parsed.response;

  const { productId, sku, quantity, color } = parsed.data;
  const product = productId ? await getProductById(productId) : await getProductBySku(sku!);
  if (!product) return fail('NOT_FOUND', 'Produit introuvable.');

  if (color && !product.colors.includes(color)) {
    return fail('VALIDATION_ERROR', 'Coloris indisponible pour ce produit.', [
      { field: 'color', message: `Coloris disponibles : ${product.colors.join(', ')}.` },
    ]);
  }

  const cart = await resolveCartForWrite(request);
  const result = await addItem(cart, product.id, quantity, color ?? null);

  if (!result.ok) {
    if (result.reason === 'out_of_stock') {
      return fail('OUT_OF_STOCK', `Stock insuffisant pour « ${product.name} ».`);
    }
    if (result.reason === 'max_quantity') {
      return fail('MAX_QUANTITY', `Quantité maximale de ${MAX_QUANTITY_PER_LINE} articles par ligne.`);
    }
    return fail('NOT_FOUND', 'Produit introuvable.');
  }

  return created(result.cart);
}
