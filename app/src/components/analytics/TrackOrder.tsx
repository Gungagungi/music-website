'use client';

import { useEffect } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';
import type { CartItem, CartTotals } from '@/lib/types';

/** What the tracker needs to know about an order line. */
type Ligne = Pick<CartItem, 'sku' | 'brand' | 'name' | 'unitPrice' | 'quantity'>;

/**
 * Records an order with Matomo, from the confirmation page.
 *
 * It is the only place in the journey where all the data is already at hand —
 * lines, reference, totals — without an extra request. Matomo deduplicates on
 * the reference: reloading the page or going back does not count a second
 * order.
 *
 * The fields are listed individually rather than receiving the whole `Order`:
 * whatever a client component receives is serialised into the payload sent to
 * the browser, and `Order` carries `accessToken`, the token that grants access
 * to the order. Passing it here would write it into the HTML of every order,
 * for a tracker that has no use for it.
 *
 * Domain totals are VAT-inclusive and the discount is already deducted from
 * `total` (see lib/money.ts). The subtotal sent is therefore the subtotal minus
 * the discount, otherwise Matomo would report a gap between the grand total and
 * the sum of its parts.
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
