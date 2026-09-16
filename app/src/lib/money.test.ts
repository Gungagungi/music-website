import { describe, expect, it } from 'vitest';

import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT_RATE,
  applyPercent,
  formatPrice,
  roundCents,
  shippingFor,
  vatIncludedIn,
} from '@/lib/money';

/**
 * These tests target the boundaries, not the nominal cases: a total correct to
 * the cent on an ordinary cart says nothing about the rounding rule, whereas a
 * negative half-cent pins it down entirely.
 */

describe('roundCents', () => {
  it('arrondit le demi au supérieur', () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(2.4)).toBe(2);
  });

  // `Math.round(-2.5)` is -2: JavaScript rounds towards +∞, not by absolute
  // value. French invoicing convention wants -3, hence the function's explicit
  // symmetry — which is what this test holds.
  it('arrondit le demi négatif à l’opposé du positif', () => {
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(-2.4)).toBe(-2);
  });

  // Without `Object.is`, `-0` would pass: `expect(-0).toBe(0)` is true with
  // strict `toBe` but false here, and a negative zero propagates all the way to
  // the display (`-0,00 €`).
  it('renvoie un zéro positif pour zéro', () => {
    expect(Object.is(roundCents(0), 0)).toBe(true);
  });

  it('laisse les entiers intacts', () => {
    expect(roundCents(1990)).toBe(1990);
    expect(roundCents(-1990)).toBe(-1990);
  });
});

describe('applyPercent', () => {
  it('calcule un pourcentage en centimes entiers', () => {
    expect(applyPercent(10000, 10)).toBe(1000);
    expect(applyPercent(84900, 15)).toBe(12735);
  });

  // 12345 × 10 % = 1234.5 cents. The half goes up, and above all the result
  // must not stay fractional: that is the defect BUG-001 caricatures the other
  // way round by truncating to the euro.
  it('arrondit le demi-centime au supérieur', () => {
    expect(applyPercent(12345, 10)).toBe(1235);
  });

  it('rend zéro pour un pourcentage nul ou un montant nul', () => {
    expect(applyPercent(84900, 0)).toBe(0);
    expect(applyPercent(0, 20)).toBe(0);
  });

  it('accepte un pourcentage total', () => {
    expect(applyPercent(84900, 100)).toBe(84900);
  });
});

describe('vatIncludedIn', () => {
  // Prices are displayed VAT-inclusive: VAT is extracted from the total, never
  // added on top. €120.00 incl. VAT contains €20.00 of VAT — not €24.00, which
  // added VAT would produce.
  it('extrait la TVA du total au lieu de l’ajouter', () => {
    expect(vatIncludedIn(12000)).toBe(2000);
    expect(vatIncludedIn(12000)).not.toBe(2400);
  });

  it('arrondit la part de TVA au centime', () => {
    expect(vatIncludedIn(84900)).toBe(14150);
    expect(vatIncludedIn(999)).toBe(167);
  });

  it('rend zéro pour un total nul', () => {
    expect(vatIncludedIn(0)).toBe(0);
  });
});

describe('shippingFor', () => {
  it('facture le forfait sous le seuil', () => {
    expect(shippingFor(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_FLAT_RATE);
    expect(shippingFor(1)).toBe(SHIPPING_FLAT_RATE);
  });

  // The threshold is reached, not exceeded: `>=` and not `>`. One cent separates
  // the two assertions, and that is all that distinguishes the two
  // implementations.
  it('offre le port à partir du seuil exact', () => {
    expect(shippingFor(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(shippingFor(FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });

  // An empty cart must not be charged €9.90 for shipping.
  it('ne facture rien pour un sous-total nul ou négatif', () => {
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(-100)).toBe(0);
  });
});

describe('formatPrice', () => {
  // The space before the symbol is non-breaking (U+00A0): that is what `Intl`
  // produces, and what the UI suite's selectors run into.
  it('formate en euros avec une espace insécable avant le symbole', () => {
    expect(formatPrice(84900)).toBe('849,00 €');
  });

  it('force deux décimales', () => {
    expect(formatPrice(80000)).toBe('800,00 €');
    expect(formatPrice(1)).toBe('0,01 €');
  });

  it('formate les montants négatifs', () => {
    expect(formatPrice(-1250)).toBe('-12,50 €');
  });

  // The thousands separator depends on the ICU version (U+202F or U+00A0
  // depending on the runtime): normalising it avoids a test that turns red when
  // Node changes without any business rule having moved.
  it('sépare les milliers', () => {
    expect(formatPrice(123450).replace(/[\s  ]/g, ' ')).toBe('1 234,50 €');
  });

  it('accepte une autre devise', () => {
    expect(formatPrice(84900, 'USD')).toContain('849,00');
  });
});
