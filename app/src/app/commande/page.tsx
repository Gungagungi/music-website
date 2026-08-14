import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { CheckoutForm } from '@/components/CheckoutForm';
import { currentCartId, currentUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Commande' };

export default async function CheckoutPage() {
  const [user, cartId] = await Promise.all([currentUser(), currentCartId()]);
  const cart = getCart(cartId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb
        trail={[{ label: 'Accueil', href: '/' }, { label: 'Panier', href: '/panier' }, { label: 'Commande' }]}
      />
      <h1 className="mt-4 text-3xl font-bold" data-testid="checkout-title">
        Finaliser ma commande
      </h1>

      <div className="mt-8">
        {!cart || cart.items.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-ink-300 bg-white p-12 text-center"
            data-testid="checkout-empty"
          >
            <p className="text-xl font-semibold">Votre panier est vide.</p>
            <p className="mt-2 text-ink-500">
              Ajoutez au moins un article avant de passer commande.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded bg-ink-900 px-5 py-3 font-semibold text-white"
              data-testid="checkout-empty-cta"
            >
              Retour à la boutique
            </Link>
          </div>
        ) : (
          <>
            {!user && (
              <p className="mb-6 rounded border border-ink-100 bg-white p-4 text-sm" data-testid="guest-notice">
                Vous commandez en tant qu’invité.{' '}
                <Link href="/compte/connexion?redirect=/commande" className="underline hover:text-amber-brand">
                  Connectez-vous
                </Link>{' '}
                pour retrouver cette commande dans votre historique.
              </p>
            )}
            <CheckoutForm cart={cart} isAuthenticated={Boolean(user)} />
          </>
        )}
      </div>
    </div>
  );
}
