'use client';

import { useEffect } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';

/**
 * Déclare la fiche produit courante à Matomo.
 *
 * `setEcommerceView` ne fait qu'armer la prochaine vue de page : c'est le
 * `trackPageView` qui suit qui l'enregistre. On le pousse donc ici, après, et
 * c'est aussi pourquoi le composant appartient à la page produit et pas au
 * layout — l'appel n'a de sens qu'une fois qu'on sait quel produit est affiché.
 */
export function TrackProductView({
  sku,
  name,
  category,
  price,
}: {
  sku: string;
  name: string;
  category: string;
  /** En centimes, comme partout dans le domaine. */
  price: number;
}) {
  useEffect(() => {
    push(['setEcommerceView', sku, name, category, enUnitesMonetaires(price)]);
    push(['trackPageView']);
  }, [sku, name, category, price]);

  return null;
}
