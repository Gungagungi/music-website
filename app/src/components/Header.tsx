import Link from 'next/link';

import { CATEGORIES, CATEGORY_GROUPS } from '@/data/categories';
import { currentCartId, currentUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';
import { SearchBar } from '@/components/SearchBar';

export async function Header() {
  const [user, cartId] = await Promise.all([currentUser(), currentCartId()]);
  const cart = getCart(cartId);
  const itemCount = cart?.totals.itemCount ?? 0;

  return (
    <header className="bg-ink-950 text-white" data-testid="site-header">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
          data-testid="logo"
          aria-label="Fretline, retour à l’accueil"
        >
          <span aria-hidden="true" className="text-amber-brand text-2xl">
            ⌇
          </span>
          Fretline
        </Link>

        <div className="order-3 w-full md:order-2 md:w-auto md:flex-1">
          <SearchBar />
        </div>

        <nav aria-label="Compte et panier" className="order-2 ml-auto flex items-center gap-4 md:order-3">
          {user ? (
            <Link
              href="/compte/commandes"
              className="text-sm hover:text-amber-brand"
              data-testid="account-link"
            >
              Mon compte ({user.firstName})
            </Link>
          ) : (
            <Link
              href="/compte/connexion"
              className="text-sm hover:text-amber-brand"
              data-testid="login-link"
            >
              Se connecter
            </Link>
          )}

          <Link
            href="/panier"
            className="relative flex items-center gap-2 rounded-md bg-amber-brand px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
            data-testid="cart-link"
          >
            Panier
            <span
              className="min-w-6 rounded-full bg-ink-950 px-2 py-0.5 text-center text-xs font-bold text-white"
              data-testid="cart-count"
              aria-label={`${itemCount} article${itemCount > 1 ? 's' : ''} dans le panier`}
            >
              {itemCount}
            </span>
          </Link>
        </nav>
      </div>

      <nav aria-label="Catégories de produits" className="bg-ink-900" data-testid="category-nav">
        <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm">
          {CATEGORY_GROUPS.map((group) => (
            <li key={group} className="group relative">
              <span className="font-semibold text-ink-100">{group}</span>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-300">
                {CATEGORIES.filter((category) => category.group === group).map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/c/${category.slug}`}
                      className="hover:text-amber-brand"
                      data-testid={`nav-${category.slug}`}
                    >
                      {category.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
