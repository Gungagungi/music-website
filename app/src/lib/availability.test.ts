import { describe, expect, it } from 'vitest';

import { LOW_STOCK_THRESHOLD, availabilityFor } from '@/lib/availability';

/**
 * Comme pour l'arithmétique monétaire, ces tests visent les bornes. Un stock de
 * 42 ne dit rien de la règle ; c'est le passage de 3 à 4, et celui de 0 à 1,
 * qui la décrivent entièrement.
 */

describe('availabilityFor', () => {
  it('annonce une rupture à stock nul', () => {
    const availability = availabilityFor(0);

    expect(availability.level).toBe('rupture');
    expect(availability.orderable).toBe(false);
    expect(availability.shipping).toContain('3 à 4 semaines');
  });

  // La contrainte CHECK en base rend ce cas impossible côté stockage, mais la
  // fonction sert aussi ce qu'une réponse d'API a rapporté. « Plus que -2 en
  // stock » serait un échec plus embarrassant qu'une rupture affichée à tort.
  it('traite un stock négatif comme une rupture', () => {
    expect(availabilityFor(-2).level).toBe('rupture');
  });

  it('signale la dernière unité en nommant le nombre restant', () => {
    const availability = availabilityFor(1);

    expect(availability.level).toBe('stock-faible');
    expect(availability.label).toBe('Plus que 1 en stock');
    expect(availability.orderable).toBe(true);
  });

  it('reste en stock faible jusqu’au seuil inclus', () => {
    expect(availabilityFor(LOW_STOCK_THRESHOLD).level).toBe('stock-faible');
    expect(availabilityFor(LOW_STOCK_THRESHOLD + 1).level).toBe('en-stock');
  });

  it('expédie sous 24 h dès qu’il reste une unité', () => {
    expect(availabilityFor(1).shipping).toBe('Expédié sous 24 h');
    expect(availabilityFor(50).shipping).toBe('Expédié sous 24 h');
  });
});
