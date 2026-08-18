import { ok } from '@/lib/api';
import { clearCart } from '@/lib/cart';
import { resolveCart } from '@/lib/cart-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return ok(await resolveCart(request));
}

export async function DELETE(request: Request) {
  const cart = await resolveCart(request);
  return ok(await clearCart(cart));
}
