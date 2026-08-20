'use client';

import { useEffect } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';

/**
 * Déclare la fiche produit courante à Matomo.
 *
 * `setEcommerceView` ne fait qu'armer la prochaine vue de page : c'est le
 * `trackPageView` qui suit qui l'enregistre. Ce `trackPageView` n'est pas ici —
 * il appartient à SuiviDeNavigation, qui l'émet pour toutes les pages. En
 * pousser un second produirait deux vues pour une seule consultation.
 *
 * L'ordre entre les deux tient au fait que React exécute les effets des enfants
 * avant ceux des parents : ce composant vit dans la page, SuiviDeNavigation
 * dans le layout. Voir le commentaire de SuiviDeNavigation.
 *
 * Le composant appartient à la page produit et pas au layout : l'appel n'a de
 * sens qu'une fois qu'on sait quel produit est affiché.
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
  }, [sku, name, category, price]);

  return null;
}
