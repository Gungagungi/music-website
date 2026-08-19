/**
 * All monetary amounts in this application are integers in cents.
 *
 * Floating point euros are the single most common source of off-by-one-cent
 * bugs in e-commerce, and they make assertions in the test suite unreliable
 * (`expect(total).toBe(19.99)` fails for reasons that have nothing to do with
 * the feature under test). Keeping cents as integers means every total is
 * exactly comparable, in the app and in the tests alike.
 */

export const VAT_RATE = 0.2;
export const FREE_SHIPPING_THRESHOLD = 19900; // 199,00 €
export const SHIPPING_FLAT_RATE = 990; // 9,90 €

/** Rounds half away from zero, the convention French invoices use. */
export function roundCents(value: number): number {
  // Stryker disable next-line EqualityOperator: mutant équivalent. `<` et `<=`
  // ne diffèrent qu'en zéro, où les deux branches rendent le même résultat :
  // `-Math.round(-0)` vaut `+0`, la double négation annulant le zéro négatif.
  // Aucun test ne peut le tuer, et le seuil reste donc à 100 %.
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function applyPercent(amountCents: number, percent: number): number {
  return roundCents((amountCents * percent) / 100);
}

/**
 * Displayed prices are VAT-inclusive (French retail convention), so the VAT
 * portion is extracted from the total rather than added on top.
 */
export function vatIncludedIn(totalCents: number): number {
  return roundCents(totalCents - totalCents / (1 + VAT_RATE));
}

export function shippingFor(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
}

/** `84900` → `"849,00 €"` — non-breaking spaces included, as `Intl` produces them. */
export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
