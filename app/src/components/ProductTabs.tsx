import Link from 'next/link';

import { ProductGrid } from '@/components/ProductGrid';
import { formatPrice } from '@/lib/money';
import type { Product } from '@/lib/types';

/**
 * The product page's detail tabs.
 *
 * Links, not buttons, and the active tab is a query parameter: a tab is a
 * different view of the page, so it should be shareable and reloadable. That
 * also means the panel is rendered on the server and a spec asserts on served
 * HTML rather than on a click handler.
 *
 * `Caractéristiques` is the default deliberately. The description already sits
 * in the identity block above, so a "Description" tab would repeat it, and
 * making the specification table the landing panel keeps it where it has always
 * been for anyone — reader or spec — who expects to find it without clicking.
 *
 * There is no "Téléchargements" tab. Fretline's catalogue is generated, and
 * inventing manuals nobody wrote would be a tab that lies.
 */

export const PRODUCT_TABS = ['caracteristiques', 'accessoires', 'livraison'] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number];

const LABELS: Record<ProductTab, string> = {
  caracteristiques: 'Caractéristiques',
  accessoires: 'Accessoires compatibles',
  livraison: 'Livraison et garantie',
};

export function parseProductTab(raw: string | string[] | undefined): ProductTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PRODUCT_TABS.includes(value as ProductTab) ? (value as ProductTab) : 'caracteristiques';
}

export function ProductTabs({
  slug,
  active,
  specs,
  accessories,
}: {
  slug: string;
  active: ProductTab;
  specs: Record<string, string>;
  accessories: Product[];
}) {
  return (
    <section className="mt-10" aria-labelledby="details-title">
      <h2 id="details-title" className="sr-only">
        Détails du produit
      </h2>

      {/* A tab list of links. `aria-current` rather than `aria-selected`: these
          are navigations, and the ARIA tab pattern would promise keyboard
          behaviour (arrow keys, roving tabindex) that plain links do not have.
          Claiming a pattern one does not implement is worse than not claiming
          it — the axe scan caught exactly this kind of mismatch on the review
          histogram. */}
      <nav aria-label="Détails du produit" data-testid="product-tabs">
        <ul className="flex flex-wrap gap-1 border-b border-line">
          {PRODUCT_TABS.map((tab) => {
            const isActive = tab === active;
            return (
              <li key={tab}>
                <Link
                  href={
                    tab === 'caracteristiques'
                      ? `/p/${slug}#details-title`
                      : `/p/${slug}?onglet=${tab}#details-title`
                  }
                  aria-current={isActive ? true : undefined}
                  data-testid={`product-tab-${tab}`}
                  data-active={isActive ? 'true' : 'false'}
                  className={
                    isActive
                      ? 'inline-block border-b-2 border-amber-brand px-4 py-2 text-sm font-semibold'
                      : 'inline-block border-b-2 border-transparent px-4 py-2 text-sm text-fg-muted hover:text-amber-brand'
                  }
                >
                  {LABELS[tab]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6" data-testid="product-tab-panel" data-tab={active}>
        {active === 'caracteristiques' && (
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="product-specs">
            {Object.entries(specs).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-line py-2">
                <dt className="text-sm text-fg-muted">{key}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {active === 'accessoires' &&
          (accessories.length === 0 ? (
            <p className="text-fg-muted" data-testid="no-accessories">
              Aucun accessoire compatible pour le moment.
            </p>
          ) : (
            <ProductGrid products={accessories} testId="accessories" />
          ))}

        {active === 'livraison' && (
          <ul className="space-y-2 text-sm" data-testid="shipping-terms">
            <li>Livraison offerte dès {formatPrice(19900)}, {formatPrice(990)} en dessous.</li>
            <li>Retour sous 30 jours, sans justification, frais de retour à notre charge.</li>
            <li>Garantie constructeur 3 ans, pièces et main-d’œuvre.</li>
            <li>Réglage offert par notre atelier sur tout instrument à cordes.</li>
          </ul>
        )}
      </div>
    </section>
  );
}
