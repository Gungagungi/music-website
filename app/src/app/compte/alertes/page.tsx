import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { currentUser } from '@/lib/auth';
import { alertsForUser } from '@/lib/repositories/stock-alerts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes alertes' };

/**
 * The customer's own restock alerts.
 *
 * Listable and cancellable from here, which is the practical reason the alert
 * is attached to an account rather than to a bare e-mail address: an address
 * alone would need a token in a link to be unsubscribed, and a whole flow
 * around it.
 */
export default async function AlertsPage() {
  const user = await currentUser();
  if (!user) redirect('/compte/connexion?redirect=/compte/alertes');

  const alerts = await alertsForUser(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Mes alertes' }]} />

      <h1 className="mt-4 text-3xl font-bold" data-testid="alerts-title">
        Mes alertes de retour en stock
      </h1>

      {alerts.length === 0 ? (
        <div
          className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface p-12 text-center"
          data-testid="alerts-empty"
        >
          <p className="text-lg font-semibold">Aucune alerte en cours.</p>
          <p className="mt-2 text-sm text-fg-muted">
            Depuis la fiche d’un produit en rupture, demandez à être prévenu de son retour.
          </p>
          <Link href="/" className="mt-4 inline-block underline hover:text-amber-brand">
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3" data-testid="alert-list" data-count={alerts.length}>
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4"
              data-testid="alert-item"
              data-slug={alert.slug}
              data-notified={alert.notifiedAt ? 'true' : 'false'}
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">{alert.brand}</p>
                <Link href={`/p/${alert.slug}`} className="font-semibold hover:text-amber-brand">
                  {alert.name}
                </Link>
              </div>

              {/* The state machine is a single column, and it is worth showing:
                  an alert that already fired stays listed, so a second restock
                  cannot re-notify someone who asked once. */}
              <p className="text-sm font-semibold" data-testid="alert-state">
                {alert.notifiedAt ? 'Retour signalé' : 'En attente'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
