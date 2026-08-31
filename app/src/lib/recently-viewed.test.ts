import { describe, expect, it } from 'vitest';

import {
  MAX_RECENTLY_VIEWED,
  parseRecentlyViewed,
  recordVisit,
  serialiseRecentlyViewed,
} from '@/lib/recently-viewed';

describe('parseRecentlyViewed', () => {
  it('rend une liste vide pour un cookie absent', () => {
    expect(parseRecentlyViewed(undefined)).toEqual([]);
  });

  it('écarte ce qui n’a pas la forme d’un slug et dédoublonne', () => {
    expect(parseRecentlyViewed('a,<script>,a,b')).toEqual(['a', 'b']);
  });

  it('plafonne la liste', () => {
    expect(parseRecentlyViewed('a,b,c,d,e,f,g,h')).toHaveLength(MAX_RECENTLY_VIEWED);
  });
});

describe('recordVisit', () => {
  it('place la visite en tête', () => {
    expect(recordVisit(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  // Une re-visite remonte le produit au lieu de le dupliquer : l'historique
  // décrit l'ordre des visites, pas leur nombre.
  it('remonte un produit déjà vu sans le dupliquer', () => {
    expect(recordVisit(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  // À l'inverse du comparateur, qui refuse un quatrième produit : une sélection
  // délibérée se remarque quand on la perd, un historique non.
  it('évince la visite la plus ancienne au-delà de la limite', () => {
    const full = ['a', 'b', 'c', 'd', 'e', 'f'];

    expect(recordVisit(full, 'g')).toEqual(['g', 'a', 'b', 'c', 'd', 'e']);
  });
});

describe('serialiseRecentlyViewed', () => {
  it('fait l’aller-retour avec la lecture', () => {
    expect(parseRecentlyViewed(serialiseRecentlyViewed(['a', 'b']))).toEqual(['a', 'b']);
  });
});
