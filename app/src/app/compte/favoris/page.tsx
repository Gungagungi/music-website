import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { ProductGrid } from '@/components/ProductGrid';
import { currentUser } from '@/lib/auth';
import { wishlistFor } from '@/lib/repositories/wishlist';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mes favoris' };

/**
 * The customer's saved products.
 *
 * Rendered with the ordinary product grid rather than a bespoke list, so a
 * price cut or a return to stock is visible here exactly as it is in the
 * catalogue — which is most of what a wish list is for.
 */
export default async function WishlistPage() {
  const user = await currentUser();
  if (!user) redirect('/compte/connexion?redirect=/compte/favoris');

  const products = await wishlistFor(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Mes favoris' }]} />

      <h1 className="mt-4 text-3xl font-bold" data-testid="wishlist-title">
        Mes favoris
      </h1>

      {products.length === 0 ? (
        <div
          className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface p-12 text-center"
          data-testid="wishlist-empty"
        >
          <p className="text-lg font-semibold">Aucun favori pour le moment.</p>
          <p className="mt-2 text-sm text-fg-muted">
            Depuis une fiche produit, enregistrez ce que vous voulez retrouver plus tard.
          </p>
          <Link href="/" className="mt-4 inline-block underline hover:text-amber-brand">
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid products={products} testId="wishlist" />
        </div>
      )}
    </div>
  );
}
