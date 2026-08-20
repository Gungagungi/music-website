'use client';

import { useEffect } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';
import type { CartItem, CartTotals } from '@/lib/types';

/** Ce que le tracker a besoin de connaître d'une ligne de commande. */
type Ligne = Pick<CartItem, 'sku' | 'brand' | 'name' | 'unitPrice' | 'quantity'>;

/**
 * Enregistre une commande auprès de Matomo, depuis la page de confirmation.
 *
 * C'est le seul endroit du parcours où toutes les données sont déjà là — lignes,
 * référence, totaux — sans requête supplémentaire. Matomo déduplique sur la
 * référence : un rechargement de la page ou un retour arrière ne comptent pas
 * une seconde commande.
 *
 * Les champs sont énumérés plutôt que de recevoir l'`Order` entier : ce qu'un
 * composant client reçoit est sérialisé dans la charge utile envoyée au
 * navigateur, et `Order` porte `accessToken`, le jeton qui autorise à consulter
 * la commande. Le passer ici l'écrirait dans le HTML de toutes les commandes,
 * pour un tracker qui n'en a aucun usage.
 *
 * Les totaux du domaine sont TTC et la remise est déjà déduite de `total` (voir
 * lib/money.ts). Le sous-total transmis est donc le sous-total moins la remise,
 * faute de quoi Matomo signalerait un écart entre le grand total et la somme de
 * ses composantes.
 */
export function TrackOrder({
  reference,
  items,
  totals,
}: {
  reference: string;
  items: Ligne[];
  totals: CartTotals;
}) {
  useEffect(() => {
    for (const item of items) {
      push([
        'addEcommerceItem',
        item.sku,
        `${item.brand} ${item.name}`,
        '',
        enUnitesMonetaires(item.unitPrice),
        item.quantity,
      ]);
    }

    push([
      'trackEcommerceOrder',
      reference,
      enUnitesMonetaires(totals.total),
      enUnitesMonetaires(totals.subtotal - totals.discount),
      enUnitesMonetaires(totals.vat),
      enUnitesMonetaires(totals.shipping),
      totals.discount > 0 ? enUnitesMonetaires(totals.discount) : false,
    ]);
  }, [reference, items, totals]);

  return null;
}
