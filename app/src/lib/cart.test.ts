import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeTotals, discountFor, emptyTotals, evaluateCouponWith } from '@/lib/cart';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE } from '@/lib/money';
import type { Categories } from '@/lib/cart';
import type { CartItem, Coupon } from '@/lib/types';

/**
 * Seules les fonctions pures de `cart.ts` sont testées ici. Les enveloppes
 * asynchrones plus bas dans le fichier touchent la base et restent couvertes par
 * la suite d'API, qui les éprouve contre un vrai PostgreSQL.
 *
 * L'import de `cart.ts` traverse les repositories, donc le client de base : il
 * ne doit ouvrir aucune connexion. C'est la garantie que donne le pool paresseux
 * derrière son `Proxy`, et ce fichier la met à l'épreuve à chaque exécution.
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

  // Une date d'expiration future n'est pas une expiration : sans ce cas, un
  // `<` retourné en `>` passerait inaperçu.
  it('accepte un coupon dont l’expiration est à venir', () => {
    const valide = coupon({ expiresAt: '2999-01-01T00:00:00.000Z' });
    expect(evaluateCouponWith(valide, items, sansCategorie)).toMatchObject({ ok: true });
  });

  // `<` et non `<=` : un coupon valable « jusqu'au 31 décembre » l'est encore à
  // l'instant exact de son échéance. La distinction ne s'observe qu'en figeant
  // l'horloge — sans quoi la milliseconde du test décide du résultat.
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

  // Le minimum est atteint, pas dépassé : un centime sépare l'acceptation du
  // refus.
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

  // L'ordre des contrôles est significatif : un coupon à la fois expiré et
  // sous le minimum doit se dire expiré, sans quoi le message d'erreur
  // désigne la mauvaise cause.
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

  // 849,00 € à 15 % font 127,35 € — un montant qui n'est pas un nombre rond
  // d'euros. C'est exactement ce que BUG-001 casse.
  it('ne tronque pas le pourcentage à l’euro', () => {
    expect(discountFor(items, coupon({ value: 15 }), sansCategorie)).toBe(12735);
  });

  it('applique un montant fixe tel quel', () => {
    expect(discountFor(items, coupon({ type: 'fixed', value: 5000 }), sansCategorie)).toBe(5000);
  });

  // Une remise fixe ne peut pas dépasser ce qu'elle remise : sinon le panier
  // devient créditeur.
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

  // Un coupon refusé ne remise rien : sans ce test, supprimer l'évaluation et
  // appeler `discountFor` directement passerait vert.
  it('n’applique pas un coupon refusé', () => {
    const items = [ligne({ lineTotal: 10000 })];
    const exigeant = coupon({ value: 10, minSubtotal: 20000 });
    expect(computeTotals(items, exigeant, sansCategorie).discount).toBe(0);
  });

  it('applique un coupon accepté', () => {
    const items = [ligne({ lineTotal: 10000 })];
    expect(computeTotals(items, coupon({ value: 10 }), sansCategorie).discount).toBe(1000);
  });

  // La remise s'applique avant le calcul du port : un panier qui passe sous le
  // seuil de franco à cause d'un coupon paie le port.
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
 * BUG-001, le défaut semé. Le job `demo-defauts` vérifie que la suite le
 * détecte de bout en bout ; ici on tient la définition elle-même, sans quoi
 * le mutant qui remplacerait `Math.floor` par `Math.ceil` survivrait — et un
 * défaut semé qui dérive cesse de correspondre à son rapport de bug.
 *
 * La constante est lue à l'import, donc le module doit être rechargé après avoir
 * posé la variable.
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
    // 15 % de 849,00 € font 127,35 € ; le défaut rend 127,00 €.
    expect(bogue(items, coupon({ value: 15 }), sansCategorie)).toBe(12700);
  });

  it('laisse les remises fixes intactes', async () => {
    const { discountFor: bogue } = await cartAvecDefaut();
    const items = [ligne({ lineTotal: 84900 })];
    expect(bogue(items, coupon({ type: 'fixed', value: 5055 }), sansCategorie)).toBe(5055);
  });
});
