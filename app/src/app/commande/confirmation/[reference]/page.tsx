import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { currentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { formatPrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Commande confirmée' };

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token } = await searchParams;

  const order = getDb().orders.find((candidate) => candidate.reference === reference);
  if (!order) notFound();

  // Mirrors the API rule: the owner, or whoever holds the one-time access token.
  const user = await currentUser();
  const authorised = (token && token === order.accessToken) || (user && order.userId === user.id);
  if (!authorised) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Confirmation' }]} />

      <div className="mt-6 rounded-lg border border-green-600 bg-green-50 p-6" data-testid="order-confirmation">
        <h1 className="text-3xl font-bold">Merci pour votre commande !</h1>
        <p className="mt-2">
          Votre commande{' '}
          <strong data-testid="order-reference">{order.reference}</strong> a bien été enregistrée.
          Un e-mail de confirmation a été envoyé à{' '}
          <strong data-testid="order-email">{order.email}</strong>.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-ink-100 bg-white p-6" aria-labelledby="order-detail-title">
        <h2 id="order-detail-title" className="text-xl font-bold">
          Détail de la commande
        </h2>

        <ul className="mt-4 space-y-2 text-sm" data-testid="order-lines" data-count={order.items.length}>
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span>
                {item.quantity} × {item.brand} {item.name}
                {item.color ? ` — ${item.color}` : ''}
              </span>
              <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2 border-t border-ink-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Sous-total</dt>
            <dd data-testid="order-subtotal">{formatPrice(order.totals.subtotal)}</dd>
          </div>
          {order.totals.discount > 0 && (
            <div className="flex justify-between">
              <dt>Remise ({order.couponCode})</dt>
              <dd data-testid="order-discount">- {formatPrice(order.totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Livraison</dt>
            <dd data-testid="order-shipping">
              {order.totals.shipping === 0 ? 'Offerte' : formatPrice(order.totals.shipping)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-ink-100 pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd data-testid="order-total">{formatPrice(order.totals.total)}</dd>
          </div>
        </dl>

        <div className="mt-6 text-sm" data-testid="order-address">
          <p className="font-semibold">Adresse de livraison</p>
          <p>
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          <p>{order.shippingAddress.line1}</p>
          {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
          <p>
            {order.shippingAddress.postalCode} {order.shippingAddress.city}
          </p>
          <p>{order.shippingAddress.country}</p>
        </div>
      </section>

      <Link
        href="/"
        className="mt-8 inline-block rounded bg-ink-900 px-5 py-3 font-semibold text-white"
        data-testid="back-to-shop"
      >
        Continuer mes achats
      </Link>
    </div>
  );
}
