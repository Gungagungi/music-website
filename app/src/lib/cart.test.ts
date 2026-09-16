import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeTotals, discountFor, emptyTotals, evaluateCouponWith } from '@/lib/cart';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE } from '@/lib/money';
import type { Categories } from '@/lib/cart';
import type { CartItem, Coupon } from '@/lib/types';

/**
 * Only the pure functions of `cart.ts` are tested here. The async wrappers
 * further down the file touch the database and stay covered by the API suite,
 * which exercises them against a real PostgreSQL.
 *
 * Importing `cart.ts` goes through the repositories, hence the database client:
 * it must open no connection. That is the guarantee the lazy pool behind its
 * `Proxy` gives, and this file puts it to the test on every run.
 */

function ligne(overrides: Partial<CartItem> & { lineTotal: number }): CartItem {
  const quantity = overrides.quantity ?? 1;
  return {
    id: 'itm-1',
    productId: 'prd-1',
    sku: 'SKU-1',
    slug: 'produit',
    name: 'Produit',
    brand: 'Fretline',
    color: null,
    unitPrice: overrides.lineTotal / quantity,
    quantity,
    ...overrides,
  };
}

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: 'PROMO',
    type: 'percent',
    value: 10,
    minSubtotal: 0,
    category: null,
    expiresAt: null,
    description: 'Coupon de test',
    ...overrides,
  };
}

const sansCategorie: Categories = new Map();

describe('emptyTotals', () => {
  it('part de zéro sur chaque poste', () => {
    expect(emptyTotals()).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      vat: 0,
      total: 0,
      itemCount: 0,
    });
  });
});

describe('evaluateCouponWith', () => {
  const items = [ligne({ lineTotal: 50000 })];

  it('accepte un coupon valide', () => {
    expect(evaluateCouponWith(coupon(), items, sansCategorie)).toEqual({
      ok: true,
      coupon: coupon(),
    });
  });

  it('refuse un coupon inconnu', () => {
    expect(evaluateCouponWith(undefined, items, sansCategorie)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('refuse un coupon expiré', () => {
    const perime = coupon({ expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(evaluateCouponWith(perime, items, sansCategorie)).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  // A future expiry date is not an expiry: without this case, a `<` flipped to
  // `>` would go unnoticed.
  it('accepte un coupon dont l’expiration est à venir', () => {
    const valide = coupon({ expiresAt: '2999-01-01T00:00:00.000Z' });
    expect(evaluateCouponWith(valide, items, sansCategorie)).toMatchObject({ ok: true });
  });

  // `<` and not `<=`: a coupon valid "until 31 December" still is at the exact
  // instant it expires. The distinction can only be observed by freezing the
  // clock — otherwise the test's millisecond decides the outcome.
  it('accepte un coupon à l’instant exact de son échéance', () => {
    const echeance = '2026-06-15T12:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(echeance));
    try {
      expect(evaluateCouponWith(coupon({ expiresAt: echeance }), items, sansCategorie)).toMatchObject(
        { ok: true },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuse une milliseconde après l’échéance', () => {
    const echeance = '2026-06-15T12:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(echeance) + 1));
    try {
      expect(evaluateCouponWith(coupon({ expiresAt: echeance }), items, sansCategorie)).toMatchObject(
        { ok: false, reason: 'expired' },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuse sous le minimum de commande', () => {
    const exigeant = coupon({ minSubtotal: 50001 });
    expect(evaluateCouponWith(exigeant, items, sansCategorie)).toMatchObject({
      ok: false,
      reason: 'min_subtotal',
    });
  });

  // The minimum is reached, not exceeded: one cent separates acceptance from
  // refusal.
  it('accepte au minimum exact', () => {
    const exigeant = coupon({ minSubtotal: 50000 });
    expect(evaluateCouponWith(exigeant, items, sansCategorie)).toMatchObject({ ok: true });
  });

  it('refuse un coupon de catégorie quand aucune ligne n’y appartient', () => {
    const cible = coupon({ category: 'basses-electriques' });
    const categories: Categories = new Map([['prd-1', 'guitares-electriques']]);
    expect(evaluateCouponWith(cible, items, categories)).toMatchObject({
      ok: false,
      reason: 'category',
    });
  });

  it('accepte un coupon de catégorie dès qu’une ligne y appartient', () => {
    const cible = coupon({ category: 'basses-electriques' });
    const categories: Categories = new Map([['prd-1', 'basses-electriques']]);
    expect(evaluateCouponWith(cible, items, categories)).toMatchObject({ ok: true });
  });

  // The order of the checks matters: a coupon that is both expired and below
  // the minimum must report itself as expired, otherwise the error message
  // points at the wrong cause.
  it('signale l’expiration avant le minimum de commande', () => {
    const doublement = coupon({ expiresAt: '2020-01-01T00:00:00.000Z', minSubtotal: 999999 });
    expect(evaluateCouponWith(doublement, items, sansCategorie)).toMatchObject({
      reason: 'expired',
    });
  });
});

describe('discountFor', () => {
  const items = [ligne({ lineTotal: 84900 })];

  it('rend zéro sans coupon', () => {
    expect(discountFor(items, undefined, sansCategorie)).toBe(0);
  });

  it('applique un pourcentage au centime près', () => {
    expect(discountFor(items, coupon({ value: 10 }), sansCategorie)).toBe(8490);
  });

  // €849.00 at 15 % comes to €127.35 — an amount that is not a round number of
  // euros. That is exactly what BUG-001 breaks.
  it('ne tronque pas le pourcentage à l’euro', () => {
    expect(discountFor(items, coupon({ value: 15 }), sansCategorie)).toBe(12735);
  });

  it('applique un montant fixe tel quel', () => {
    expect(discountFor(items, coupon({ type: 'fixed', value: 5000 }), sansCategorie)).toBe(5000);
  });

  // A fixed discount cannot exceed what it discounts: otherwise the cart goes
  // into credit.
  it('plafonne le montant fixe au sous-total éligible', () => {
    const petit = [ligne({ lineTotal: 3000 })];
    expect(discountFor(petit, coupon({ type: 'fixed', value: 5000 }), sansCategorie)).toBe(3000);
  });

  it('ne remise que les lignes de la catégorie visée', () => {
    const panier = [
      ligne({ id: 'itm-1', productId: 'prd-1', lineTotal: 100000 }),
      ligne({ id: 'itm-2', productId: 'prd-2', lineTotal: 50000 }),
    ];
    const categories: Categories = new Map([
      ['prd-1', 'guitares-electriques'],
      ['prd-2', 'basses-electriques'],
    ]);
    expect(discountFor(panier, coupon({ value: 10, category: 'basses-electriques' }), categories)).toBe(5000);
  });

  it('rend zéro quand la catégorie visée est absente du panier', () => {
    const categories: Categories = new Map([['prd-1', 'guitares-electriques']]);
    expect(discountFor(items, coupon({ value: 10, category: 'basses-electriques' }), categories)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('additionne les lignes et les quantités', () => {
    const panier = [
      ligne({ id: 'itm-1', productId: 'prd-1', lineTotal: 20000, quantity: 2 }),
      ligne({ id: 'itm-2', productId: 'prd-2', lineTotal: 5000, quantity: 1 }),
    ];
    const totaux = computeTotals(panier, undefined, sansCategorie);
    expect(totaux.subtotal).toBe(25000);
    expect(totaux.itemCount).toBe(3);
  });

  it('rend des totaux nuls pour un panier vide', () => {
    expect(computeTotals([], undefined, sansCategorie)).toEqual(emptyTotals());
  });

  // A refused coupon discounts nothing: without this test, removing the
  // evaluation and calling `discountFor` directly would pass green.
  it('n’applique pas un coupon refusé', () => {
    const items = [ligne({ lineTotal: 10000 })];
    const exigeant = coupon({ value: 10, minSubtotal: 20000 });
    expect(computeTotals(items, exigeant, sansCategorie).discount).toBe(0);
  });

  it('applique un coupon accepté', () => {
    const items = [ligne({ lineTotal: 10000 })];
    expect(computeTotals(items, coupon({ value: 10 }), sansCategorie).discount).toBe(1000);
  });

  // The discount applies before shipping is computed: a cart that drops below
  // the free-shipping threshold because of a coupon pays for shipping.
  it('calcule le port sur le sous-total après remise', () => {
    const items = [ligne({ lineTotal: FREE_SHIPPING_THRESHOLD })];
    expect(computeTotals(items, undefined, sansCategorie).shipping).toBe(0);
    expect(computeTotals(items, coupon({ type: 'fixed', value: 1 }), sansCategorie).shipping).toBe(
      SHIPPING_FLAT_RATE,
    );
  });

  it('ne descend jamais sous zéro après remise', () => {
    const items = [ligne({ lineTotal: 3000 })];
    const genereux = coupon({ type: 'fixed', value: 999999 });
    const totaux = computeTotals(items, genereux, sansCategorie);
    expect(totaux.discount).toBe(3000);
    expect(totaux.total).toBe(0);
    expect(totaux.shipping).toBe(0);
  });

  it('extrait la TVA du total, port compris', () => {
    const items = [ligne({ lineTotal: 12000 })];
    const totaux = computeTotals(items, undefined, sansCategorie);
    expect(totaux.total).toBe(12000 + SHIPPING_FLAT_RATE);
    expect(totaux.vat).toBe(2165);
  });
});

/**
 * BUG-001, the seeded defect. The `demo-defauts` job checks that the suite
 * detects it end to end; here the definition itself is pinned down, otherwise
 * the mutant replacing `Math.floor` with `Math.ceil` would survive — and a
 * seeded defect that drifts stops matching its bug report.
 *
 * The constant is read at import time, so the module must be reloaded after
 * setting the variable.
 */
describe('BUG-001 — remise tronquée à l’euro (SEED_BUGS=1)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function cartAvecDefaut() {
    vi.stubEnv('SEED_BUGS', '1');
    vi.resetModules();
    return import('@/lib/cart');
  }

  it('tronque la remise en pourcentage à l’euro inférieur', async () => {
    const { discountFor: bogue } = await cartAvecDefaut();
    const items = [ligne({ lineTotal: 84900 })];
    // 15 % of €849.00 comes to €127.35; the defect returns €127.00.
    expect(bogue(items, coupon({ value: 15 }), sansCategorie)).toBe(12700);
  });

  it('laisse les remises fixes intactes', async () => {
    const { discountFor: bogue } = await cartAvecDefaut();
    const items = [ligne({ lineTotal: 84900 })];
    expect(bogue(items, coupon({ type: 'fixed', value: 5055 }), sansCategorie)).toBe(5055);
  });
});
