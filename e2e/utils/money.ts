/**
 * The app renders prices with `Intl.NumberFormat('fr-FR')`, which emits
 * narrow no-break spaces (U+202F) as the thousands separator and a regular
 * no-break space (U+00A0) before the currency symbol. Comparing that string to
 * a hand-typed "1 899,00 €" fails in a way that costs an afternoon to debug —
 * so the suite never compares formatted strings, it parses them back to cents.
 */

const NON_DIGIT_SEPARATORS = /[\s\u00a0\u202f\u2009]/g;

export function parsePriceToCents(text: string): number {
  const cleaned = text
    .replace(NON_DIGIT_SEPARATORS, '')
    .replace('€', '')
    .replace(',', '.')
    .trim();

  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Impossible d’interpréter « ${text} » comme un montant.`);
  }
  return Math.round(value * 100);
}

/** Mirrors the application's formatter — useful for building expected labels. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function vatIncludedIn(totalCents: number, vatRate = 0.2): number {
  return Math.round(totalCents - totalCents / (1 + vatRate));
}

export function shippingFor(subtotalAfterDiscountCents: number): number {
  if (subtotalAfterDiscountCents <= 0) return 0;
  return subtotalAfterDiscountCents >= 19900 ? 0 : 990;
}

export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}
