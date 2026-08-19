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
 * Ces tests visent les bornes, pas les cas nominaux : un total juste au centime
 * près sur un panier ordinaire ne dit rien de la règle d'arrondi, alors qu'un
 * demi-centime négatif la désigne entièrement.
 */

describe('roundCents', () => {
  it('arrondit le demi au supérieur', () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(2.4)).toBe(2);
  });

  // `Math.round(-2.5)` vaut -2 : JavaScript arrondit vers +∞, pas en valeur
  // absolue. La convention des factures françaises veut -3, d'où la symétrie
  // explicite de la fonction — c'est elle que ce test tient.
  it('arrondit le demi négatif à l’opposé du positif', () => {
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(-2.4)).toBe(-2);
  });

  // Sans `Object.is`, `-0` passerait : `expect(-0).toBe(0)` est vrai en `toBe`
  // strict mais faux ici, et un zéro négatif se propage jusqu'à l'affichage
  // (`-0,00 €`).
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

  // 12345 × 10 % = 1234,5 centimes. Le demi part au supérieur, et surtout le
  // résultat ne doit pas rester fractionnaire : c'est le défaut que BUG-001
  // caricature dans l'autre sens en tronquant à l'euro.
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
  // Prix affichés TTC : la TVA est extraite du total, jamais ajoutée par-dessus.
  // 120,00 € TTC contiennent 20,00 € de TVA — et non 24,00 €, ce que produirait
  // une TVA ajoutée.
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

  // Le seuil est atteint, pas dépassé : `>=` et non `>`. Un centime d'écart
  // sépare les deux assertions, et c'est tout ce qui distingue les deux
  // implémentations.
  it('offre le port à partir du seuil exact', () => {
    expect(shippingFor(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(shippingFor(FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });

  // Un panier vide ne doit pas se voir facturer 9,90 € de port.
  it('ne facture rien pour un sous-total nul ou négatif', () => {
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(-100)).toBe(0);
  });
});

describe('formatPrice', () => {
  // L'espace avant le symbole est insécable (U+00A0) : c'est ce qu'`Intl`
  // produit, et ce que les sélecteurs de la suite UI rencontrent.
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

  // Le séparateur de milliers dépend de la version d'ICU (U+202F ou U+00A0
  // selon les runtimes) : le normaliser évite un test qui rougit au changement
  // de Node sans qu'aucune règle métier ait bougé.
  it('sépare les milliers', () => {
    expect(formatPrice(123450).replace(/[\s  ]/g, ' ')).toBe('1 234,50 €');
  });

  it('accepte une autre devise', () => {
    expect(formatPrice(84900, 'USD')).toContain('849,00');
  });
});
