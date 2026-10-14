import { describe, expect, it } from 'vitest';

import {
  MAX_COMPARED,
  isCompareFull,
  parseCompareCookie,
  serialiseCompareCookie,
  toggleCompared,
} from '@/lib/compare';

/**
 * Un cookie est du texte contrôlé par le visiteur : édité à la main, périmé,
 * tronqué. Ces tests visent donc surtout ce qui arrive quand il ment.
 */

describe('parseCompareCookie', () => {
  it('rend une liste vide pour un cookie absent ou vide', () => {
    expect(parseCompareCookie(undefined)).toEqual([]);
    expect(parseCompareCookie('')).toEqual([]);
  });

  it('écarte ce qui n’a pas la forme d’un slug', () => {
    expect(parseCompareCookie('bon-slug,<script>,autre-slug')).toEqual(['bon-slug', 'autre-slug']);
  });

  // Le même produit ajouté deux fois ne doit pas consommer deux des trois
  // emplacements — le dédoublonnage est fait à l'entrée, pas à l'affichage.
  it('dédoublonne', () => {
    expect(parseCompareCookie('a,a,b')).toEqual(['a', 'b']);
  });

  it('plafonne à la limite de comparaison', () => {
    expect(parseCompareCookie('a,b,c,d,e')).toHaveLength(MAX_COMPARED);
  });
});

describe('toggleCompared', () => {
  it('ajoute un produit absent', () => {
    expect(toggleCompared(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('retire un produit déjà présent', () => {
    expect(toggleCompared(['a', 'b'], 'a')).toEqual(['b']);
  });

  // Évincer le plus ancien retirerait silencieusement un produit que le visiteur
  // a choisi. Refuser est plus honnête, et l'appelant peut le dire.
  it('refuse l’ajout au-delà de la limite sans rien évincer', () => {
    const full = ['a', 'b', 'c'];

    expect(toggleCompared(full, 'd')).toEqual(full);
    expect(isCompareFull(full, 'd')).toBe(true);
  });

  it('laisse toujours retirer, même à pleine sélection', () => {
    expect(isCompareFull(['a', 'b', 'c'], 'b')).toBe(false);
    expect(toggleCompared(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('serialiseCompareCookie', () => {
  it('fait l’aller-retour avec la lecture', () => {
    expect(parseCompareCookie(serialiseCompareCookie(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('tronque à la limite', () => {
    expect(serialiseCompareCookie(['a', 'b', 'c', 'd'])).toBe('a,b,c');
  });
});
