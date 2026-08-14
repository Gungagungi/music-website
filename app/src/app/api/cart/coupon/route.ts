import { fail, ok, parseBody } from '@/lib/api';
import { evaluateCoupon, recalc } from '@/lib/cart';
import { resolveCart } from '@/lib/cart-session';
import { formatPrice } from '@/lib/money';
import { couponSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseBody(request, couponSchema);
  if (!parsed.ok) return parsed.response;

  const cart = await resolveCart(request);
  const evaluated = evaluateCoupon(parsed.data.code, cart.items);

  if (!evaluated.ok) {
    switch (evaluated.reason) {
      case 'unknown':
        return fail('COUPON_UNKNOWN', 'Ce code promo n’existe pas.');
      case 'expired':
        return fail('COUPON_EXPIRED', 'Ce code promo a expiré.');
      case 'min_subtotal':
        return fail(
          'COUPON_MIN_SUBTOTAL',
          `Ce code promo requiert un panier d’au moins ${formatPrice(evaluated.coupon!.minSubtotal)}.`,
        );
      case 'category':
        return fail('COUPON_CATEGORY', 'Ce code promo ne s’applique à aucun article du panier.');
    }
  }

  cart.couponCode = evaluated.coupon.code;
  return ok(recalc(cart));
}

export async function DELETE(request: Request) {
  const cart = await resolveCart(request);
  cart.couponCode = null;
  return ok(recalc(cart));
}
