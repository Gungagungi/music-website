import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { LogoutButton } from '@/components/LogoutButton';
import { currentUser } from '@/lib/auth';
import { ordersForUser } from '@/lib/repositories/orders';
import { formatPrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes commandes' };

const STATUS_LABELS: Record<string, string> = {
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export default async function OrdersPage() {
  const user = await currentUser();
  if (!user) redirect('/compte/connexion?redirect=/compte/commandes');

  const orders = await ordersForUser(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Mes commandes' }]} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="orders-title">
            Mes commandes
          </h1>
          <p className="mt-1 text-ink-500" data-testid="account-email">
            Connecté en tant que {user.email}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8">
        {orders.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-ink-300 bg-white p-12 text-center"
            data-testid="empty-orders"
          >
            <p className="text-xl font-semibold">Vous n’avez pas encore de commande.</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded bg-ink-900 px-5 py-3 font-semibold text-white"
            >
              Parcourir le catalogue
            </Link>
          </div>
        ) : (
          <ul className="space-y-4" data-testid="order-list" data-count={orders.length}>
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-lg border border-ink-100 bg-white p-5"
                data-testid="order-item"
                data-reference={order.reference}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold" data-testid="order-item-reference">
                      {order.reference}
                    </p>
                    <p className="text-sm text-ink-500">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}{' '}
                      · {order.items.length} article{order.items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" data-testid="order-item-total">
                      {formatPrice(order.totals.total)}
                    </p>
                    <p
                      className="text-sm font-semibold text-green-700"
                      data-testid="order-item-status"
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 border-t border-ink-100 pt-3 text-sm text-ink-500">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.brand} {item.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
