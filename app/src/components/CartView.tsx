'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MAX_QUANTITY_PER_LINE } from '@/lib/cart-constants';
import { formatPrice } from '@/lib/money';
import type { Cart } from '@/lib/types';

export function CartView({ initialCart }: { initialCart: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [pending, setPending] = useState(false);

  async function mutate(url: string, init: RequestInit) {
    setPending(true);
    try {
      const response = await fetch(url, init);
      const payload = await response.json();
      if (response.ok) {
        setCart(payload as Cart);
        router.refresh();
        return { ok: true as const };
      }
      return { ok: false as const, message: payload?.error?.message ?? 'Opération impossible.' };
    } finally {
      setPending(false);
    }
  }

  async function changeQuantity(itemId: string, quantity: number) {
    setCouponError('');
    await mutate(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
  }

  async function removeLine(itemId: string) {
    setCouponError('');
    await mutate(`/api/cart/items/${itemId}`, { method: 'DELETE' });
  }

  async function applyCoupon(event: React.FormEvent) {
    event.preventDefault();
    setCouponError('');
    const result = await mutate('/api/cart/coupon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: couponInput }),
    });
    if (result.ok) setCouponInput('');
    else setCouponError(result.message);
  }

  async function removeCoupon() {
    setCouponError('');
    await mutate('/api/cart/coupon', { method: 'DELETE' });
  }

  if (cart.items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-ink-300 bg-white p-12 text-center"
        data-testid="empty-cart"
      >
        <p className="text-xl font-semibold">Votre panier est vide.</p>
        <p className="mt-2 text-ink-500">
          Parcourez le catalogue et ajoutez vos premiers articles pour continuer.
        </p>
        <Link
          href="/c/guitares-electriques"
          className="mt-6 inline-block rounded bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
          data-testid="empty-cart-cta"
        >
          Découvrir les guitares
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section aria-label="Articles du panier">
        <ul className="space-y-4" data-testid="cart-lines" data-count={cart.items.length}>
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-ink-100 bg-white p-4"
              data-testid="cart-line"
              data-sku={item.sku}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/product/${item.slug}`}
                alt=""
                width={80}
                height={80}
                className="size-20 rounded bg-ink-100"
              />

              <div className="min-w-40 flex-1">
                <p className="text-xs uppercase tracking-wide text-ink-500">{item.brand}</p>
                <Link href={`/p/${item.slug}`} className="font-semibold hover:text-amber-brand" data-testid="cart-line-name">
                  {item.name}
                </Link>
                {item.color && (
                  <p className="text-sm text-ink-500" data-testid="cart-line-color">
                    Coloris : {item.color}
                  </p>
                )}
                <p className="text-sm text-ink-500" data-testid="cart-line-unit-price">
                  {formatPrice(item.unitPrice)} l’unité
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor={`qty-${item.id}`} className="sr-only">
                  Quantité pour {item.name}
                </label>
                <input
                  id={`qty-${item.id}`}
                  type="number"
                  min={1}
                  max={MAX_QUANTITY_PER_LINE}
                  value={item.quantity}
                  disabled={pending}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    if (Number.isFinite(next) && next >= 1) void changeQuantity(item.id, next);
                  }}
                  className="w-20 rounded border border-ink-100 px-2 py-1"
                  data-testid="cart-line-quantity"
                />
              </div>

              <p className="w-28 text-right font-bold" data-testid="cart-line-total">
                {formatPrice(item.lineTotal)}
              </p>

              <button
                type="button"
                onClick={() => void removeLine(item.id)}
                disabled={pending}
                className="rounded border border-ink-100 px-3 py-2 text-sm hover:border-red-600 hover:text-red-700"
                data-testid="cart-line-remove"
                aria-label={`Retirer ${item.name} du panier`}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="h-fit rounded-lg border border-ink-100 bg-white p-6" data-testid="cart-summary">
        <h2 className="text-lg font-bold">Récapitulatif</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Sous-total" value={formatPrice(cart.totals.subtotal)} testId="summary-subtotal" />
          {cart.totals.discount > 0 && (
            <Row
              label={`Remise (${cart.couponCode})`}
              value={`- ${formatPrice(cart.totals.discount)}`}
              testId="summary-discount"
            />
          )}
          <Row
            label="Livraison"
            value={cart.totals.shipping === 0 ? 'Offerte' : formatPrice(cart.totals.shipping)}
            testId="summary-shipping"
          />
          <Row label="Dont TVA (20 %)" value={formatPrice(cart.totals.vat)} testId="summary-vat" muted />
          <div className="flex justify-between border-t border-ink-100 pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd data-testid="summary-total">{formatPrice(cart.totals.total)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          {cart.couponCode ? (
            <div className="flex items-center justify-between rounded border border-green-600 bg-green-50 px-3 py-2 text-sm">
              <span data-testid="applied-coupon">Code {cart.couponCode} appliqué</span>
              <button
                type="button"
                onClick={() => void removeCoupon()}
                className="underline"
                data-testid="remove-coupon"
              >
                Retirer
              </button>
            </div>
          ) : (
            <form onSubmit={applyCoupon} data-testid="coupon-form" className="space-y-2">
              <label htmlFor="coupon-code" className="block text-sm font-semibold">
                Code promo
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon-code"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  className="flex-1 rounded border border-ink-100 px-3 py-2 text-sm uppercase"
                  placeholder="BIENVENUE10"
                  data-testid="coupon-input"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
                  data-testid="coupon-submit"
                >
                  Appliquer
                </button>
              </div>
            </form>
          )}

          <p role="alert" data-testid="coupon-error" className="mt-2 text-sm font-semibold text-red-700">
            {couponError}
          </p>
        </div>

        <Link
          href="/commande"
          className="mt-6 block rounded-md bg-amber-brand px-5 py-3 text-center font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
          data-testid="checkout-link"
        >
          Passer commande
        </Link>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  testId,
  muted = false,
}: {
  label: string;
  value: string;
  testId: string;
  muted?: boolean;
}) {
  return (
    <div className={muted ? 'flex justify-between text-ink-500' : 'flex justify-between'}>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  );
}
