'use client';

import { useEffect } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';

/**
 * Declares the current product page to Matomo.
 *
 * `setEcommerceView` only arms the next page view: it is the `trackPageView`
 * that follows which records it. That `trackPageView` is not here — it belongs
 * to SuiviDeNavigation, which emits it for every page. Pushing a second one
 * would produce two views for a single visit.
 *
 * The order between the two holds because React runs children's effects before
 * their parents': this component lives in the page, SuiviDeNavigation in the
 * layout. See the comment in SuiviDeNavigation.
 *
 * The component belongs to the product page and not to the layout: the call
 * only makes sense once it is known which product is displayed.
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
  /** In cents, as everywhere in the domain. */
  price: number;
}) {
  useEffect(() => {
    push(['setEcommerceView', sku, name, category, enUnitesMonetaires(price)]);
  }, [sku, name, category, price]);

  return null;
}
