import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  buildCatalogHref,
  parseCatalogParams,
} from '@/lib/search-params';

/**
 * Catalogue URLs share the vocabulary of `GET /api/products` — same parameter
 * names, prices in cents — so that a filter replays from a page to the API by
 * copy and paste. These tests aim at what would break that equivalence: an
 * out-of-domain value accepted as is, an array reduced to its first value, an
 * empty parameter surviving in the query.
 */

describe('parseCatalogParams', () => {
  it('ne retient une catégorie que si elle appartient au domaine', () => {
    // A made-up category must vanish, not reach the repository: the query
    // would then mean "no product" instead of "the whole catalogue", and the
    // catalogue would look empty.
    expect(parseCatalogParams({ category: 'guitares-electriques' }).category).toBe(
      'guitares-electriques',
    );
    expect(parseCatalogParams({ category: 'ukuleles' }).category).toBeUndefined();
  });

  it('ne retient un tri que s’il figure dans SORT_OPTIONS', () => {
    expect(parseCatalogParams({ sort: 'prix-desc' }).sort).toBe('prix-desc');
    expect(parseCatalogParams({ sort: 'prix' }).sort).toBeUndefined();
  });

  it('conserve toutes les marques d’une sélection multiple', () => {
    expect(parseCatalogParams({ brand: ['Fender', 'Gibson'] }).brands).toEqual([
      'Fender',
      'Gibson',
    ]);
  });

  it('ramène une liste de marques vide à undefined', () => {
    // `brand=` yields ['']: a non-empty array of empty values would filter on
    // a brand that does not exist.
    expect(parseCatalogParams({ brand: '' }).brands).toBeUndefined();
    expect(parseCatalogParams({ brand: ['', ''] }).brands).toBeUndefined();
    expect(parseCatalogParams({}).brands).toBeUndefined();
  });

  it('ignore les entiers illisibles plutôt que de produire NaN', () => {
    expect(parseCatalogParams({ minPrice: 'abc' }).minPrice).toBeUndefined();
    expect(parseCatalogParams({ maxPrice: '  ' }).maxPrice).toBeUndefined();
    expect(parseCatalogParams({ page: '3' }).page).toBe(3);
  });

  it('lit les prix en centimes, sans conversion', () => {
    const query = parseCatalogParams({ minPrice: '50000', maxPrice: '150000' });
    expect(query.minPrice).toBe(50_000);
    expect(query.maxPrice).toBe(150_000);
  });

  it('ne tient pour vrai qu’une valeur booléenne explicite', () => {
    expect(parseCatalogParams({ inStock: 'true' }).inStock).toBe(true);
    expect(parseCatalogParams({ inStock: '1' }).inStock).toBe(true);
    expect(parseCatalogParams({ inStock: 'false' }).inStock).toBe(false);
    expect(parseCatalogParams({ inStock: 'oui' }).inStock).toBe(false);
    // Absent is distinct from false: an unset filter is not a filter set to
    // false, and only `undefined` lets out-of-stock products through.
    expect(parseCatalogParams({}).inStock).toBeUndefined();
  });

  it('élague la recherche et ramène une saisie blanche à undefined', () => {
    expect(parseCatalogParams({ q: '  strat mn  ' }).q).toBe('strat mn');
    expect(parseCatalogParams({ q: '   ' }).q).toBeUndefined();
  });

  it('ne garde que la première occurrence d’un paramètre scalaire répété', () => {
    expect(parseCatalogParams({ page: ['2', '5'] }).page).toBe(2);
  });
});

describe('buildCatalogHref', () => {
  it('renvoie la base seule quand rien ne subsiste', () => {
    expect(buildCatalogHref('/catalogue', {}, {})).toBe('/catalogue');
    expect(buildCatalogHref('/catalogue', { q: '' }, {})).toBe('/catalogue');
  });

  it('laisse les surcharges écraser les paramètres portés par l’URL', () => {
    expect(buildCatalogHref('/catalogue', { page: '2' }, { page: '3' })).toBe(
      '/catalogue?page=3',
    );
  });

  it('retire un paramètre quand la surcharge le vide', () => {
    // This is how a filter is unticked: overriding with '' must drop the key,
    // not produce `?category=`.
    expect(buildCatalogHref('/catalogue', { category: 'cordes' }, { category: '' })).toBe(
      '/catalogue',
    );
  });

  it('répète une clé pour chaque valeur d’un tableau', () => {
    expect(buildCatalogHref('/catalogue', {}, { brand: ['Fender', 'Gibson'] })).toBe(
      '/catalogue?brand=Fender&brand=Gibson',
    );
  });

  it('saute les valeurs vides à l’intérieur d’un tableau', () => {
    expect(buildCatalogHref('/catalogue', {}, { brand: ['Fender', ''] })).toBe(
      '/catalogue?brand=Fender',
    );
  });

  it('encode les valeurs', () => {
    expect(buildCatalogHref('/catalogue', {}, { q: 'basse 5 cordes' })).toBe(
      '/catalogue?q=basse+5+cordes',
    );
  });
});

describe('activeFilterCount', () => {
  it('ne compte ni la catégorie, ni la recherche, ni le tri, ni la page', () => {
    // This counter announces what the "Effacer les filtres" button will remove.
    // The category is navigation, not a sidebar filter.
    expect(
      activeFilterCount({
        category: 'cordes',
        q: 'strat',
        sort: 'prix-asc',
        page: 4,
      }),
    ).toBe(0);
  });

  it('compte une unité par marque sélectionnée', () => {
    expect(activeFilterCount({ brands: ['Fender', 'Gibson', 'Ibanez'] })).toBe(3);
    expect(activeFilterCount({ brands: [] })).toBe(0);
  });

  it('compte les bornes de prix séparément', () => {
    expect(activeFilterCount({ minPrice: 50_000 })).toBe(1);
    expect(activeFilterCount({ minPrice: 50_000, maxPrice: 150_000 })).toBe(2);
    // Zero is a bound that was set: `!== undefined`, not truthiness.
    expect(activeFilterCount({ minPrice: 0 })).toBe(1);
  });

  it('ne compte un booléen que lorsqu’il est vrai', () => {
    expect(activeFilterCount({ inStock: true, leftHanded: true, onSale: true })).toBe(3);
    expect(activeFilterCount({ inStock: false, leftHanded: false, onSale: false })).toBe(0);
  });

  it('compte une note minimale, y compris nulle', () => {
    expect(activeFilterCount({ minRating: 4 })).toBe(1);
    expect(activeFilterCount({ minRating: 0 })).toBe(1);
  });

  it('additionne les familles', () => {
    expect(
      activeFilterCount({
        brands: ['Fender'],
        minPrice: 50_000,
        maxPrice: 150_000,
        inStock: true,
        leftHanded: true,
        minRating: 4,
        onSale: true,
      }),
    ).toBe(7);
  });
});
