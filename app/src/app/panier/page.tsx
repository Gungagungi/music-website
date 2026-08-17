import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/Breadcrumb';
import { CartView } from '@/components/CartView';
import { currentCartId } from '@/lib/auth';
import { emptyTotals, getCart } from '@/lib/cart';
import type { Cart } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Panier' };

export default async function CartPage() {
  const cartId = await currentCartId();
  const cart: Cart = (await getCart(cartId)) ?? {
    id: 'nouveau',
    userId: null,
    items: [],
    couponCode: null,
    totals: emptyTotals(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Panier' }]} />
      <h1 className="mt-4 text-3xl font-bold" data-testid="cart-title">
        Votre panier
      </h1>
      <div className="mt-8">
        <CartView initialCart={cart} />
      </div>
    </div>
  );
}
