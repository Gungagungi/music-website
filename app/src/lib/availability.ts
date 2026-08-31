/**
 * Availability and shipping delay, derived from the stock level.
 *
 * A shop states two different things about a product: whether it can be had,
 * and when. The second is what a customer actually decides on, and it is the
 * one this repository was missing — "En stock" said nothing about waiting three
 * weeks for a back-ordered instrument.
 *
 * Everything here is a pure function of `stock`. No dates, no clock: an
 * estimated delivery *date* would change every night, which would make the
 * visual baselines flap daily and turn a stable page into a source of false
 * regressions. A relative delay ("expédié sous 24 h") says the same thing to a
 * customer and stays true tomorrow.
 */

/**
 * Below this many units, the page says how many are left rather than a bare
 * "in stock". The number itself is a merchandising choice, not a fact about the
 * warehouse — it lives here so the two places that display it cannot disagree.
 */
export const LOW_STOCK_THRESHOLD = 3;

export type AvailabilityLevel = 'en-stock' | 'stock-faible' | 'rupture';

export interface Availability {
  level: AvailabilityLevel;
  /** Short label, for a product card. */
  label: string;
  /** When it ships, phrased relatively. */
  shipping: string;
  /** Whether the product can be ordered at all. */
  orderable: boolean;
}

export function availabilityFor(stock: number): Availability {
  // Defensive rather than decorative: a negative stock is impossible in the
  // database (there is a CHECK constraint), but this function also runs against
  // whatever an API response carried, and "En stock — -2 disponibles" is a
  // worse failure than treating it as a shortage.
  if (stock <= 0) {
    return {
      level: 'rupture',
      label: 'Rupture de stock',
      shipping: 'Réapprovisionnement sous 3 à 4 semaines',
      orderable: false,
    };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      level: 'stock-faible',
      label: `Plus que ${stock} en stock`,
      shipping: 'Expédié sous 24 h',
      orderable: true,
    };
  }

  return {
    level: 'en-stock',
    label: 'En stock',
    shipping: 'Expédié sous 24 h',
    orderable: true,
  };
}
