'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export interface FacetPanelProps {
  brands: { name: string; count: number }[];
  priceBounds: { min: number; max: number };
}

/**
 * Every facet writes to the URL rather than to component state. That makes the
 * whole filtered view shareable, restorable on reload — and assertable from a
 * test without reaching into React internals.
 */
export function FacetPanel({ brands, priceBounds }: FacetPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedBrands = searchParams.getAll('brand');
  const [minPrice, setMinPrice] = useState(centsToEuroInput(searchParams.get('minPrice')));
  const [maxPrice, setMaxPrice] = useState(centsToEuroInput(searchParams.get('maxPrice')));

  function pushWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // Any filter change invalidates the current page number: staying on page 4
    // of a result set that now has two pages is a classic e-commerce dead end.
    params.delete('page');
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function toggleBrand(brand: string, checked: boolean) {
    pushWith((params) => {
      const kept = params.getAll('brand').filter((value) => value !== brand);
      params.delete('brand');
      for (const value of kept) params.append('brand', value);
      if (checked) params.append('brand', brand);
    });
  }

  function toggleFlag(key: string, checked: boolean) {
    pushWith((params) => {
      if (checked) params.set(key, 'true');
      else params.delete(key);
    });
  }

  function applyPriceRange() {
    pushWith((params) => {
      const min = euroInputToCents(minPrice);
      const max = euroInputToCents(maxPrice);
      if (min === undefined) params.delete('minPrice');
      else params.set('minPrice', String(min));
      if (max === undefined) params.delete('maxPrice');
      else params.set('maxPrice', String(max));
    });
  }

  function clearAll() {
    setMinPrice('');
    setMaxPrice('');
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    const sort = searchParams.get('sort');
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  return (
    <aside
      aria-label="Filtres"
      data-testid="facet-panel"
      className="rounded-lg border border-ink-100 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Filtrer</h2>
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-ink-500 underline hover:text-amber-brand"
          data-testid="facet-clear-all"
        >
          Tout effacer
        </button>
      </div>

      <fieldset className="mt-5" data-testid="facet-brands">
        <legend className="text-sm font-semibold">Marque</legend>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
          {brands.map((brand) => {
            const id = `brand-${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <div key={brand.name} className="flex items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4"
                  checked={selectedBrands.includes(brand.name)}
                  onChange={(event) => toggleBrand(brand.name, event.target.checked)}
                  data-testid={`facet-brand-${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                />
                <label htmlFor={id} className="flex-1 text-sm">
                  {brand.name}{' '}
                  <span className="text-ink-500">({brand.count})</span>
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6" data-testid="facet-price">
        <legend className="text-sm font-semibold">Prix (€)</legend>
        <p className="mt-1 text-xs text-ink-500">
          De {Math.floor(priceBounds.min / 100)} € à {Math.ceil(priceBounds.max / 100)} €
        </p>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="facet-min-price" className="block text-xs">
              Minimum
            </label>
            <input
              id="facet-min-price"
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              className="mt-1 w-full rounded border border-ink-100 px-2 py-1 text-sm"
              data-testid="facet-min-price"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="facet-max-price" className="block text-xs">
              Maximum
            </label>
            <input
              id="facet-max-price"
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              className="mt-1 w-full rounded border border-ink-100 px-2 py-1 text-sm"
              data-testid="facet-max-price"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={applyPriceRange}
          className="mt-2 w-full rounded bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          data-testid="facet-apply-price"
        >
          Appliquer
        </button>
      </fieldset>

      <fieldset className="mt-6 space-y-2" data-testid="facet-flags">
        <legend className="text-sm font-semibold">Disponibilité et options</legend>

        <CheckboxRow
          id="facet-in-stock"
          label="En stock uniquement"
          checked={searchParams.get('inStock') === 'true'}
          onChange={(checked) => toggleFlag('inStock', checked)}
        />
        <CheckboxRow
          id="facet-on-sale"
          label="En promotion"
          checked={searchParams.get('onSale') === 'true'}
          onChange={(checked) => toggleFlag('onSale', checked)}
        />
        <CheckboxRow
          id="facet-left-handed"
          label="Modèle gaucher"
          checked={searchParams.get('leftHanded') === 'true'}
          onChange={(checked) => toggleFlag('leftHanded', checked)}
        />
      </fieldset>

      <fieldset className="mt-6" data-testid="facet-rating">
        <legend className="text-sm font-semibold">Note minimale</legend>
        <label htmlFor="facet-min-rating" className="sr-only">
          Note minimale
        </label>
        <select
          id="facet-min-rating"
          className="mt-2 w-full rounded border border-ink-100 px-2 py-2 text-sm"
          value={searchParams.get('minRating') ?? ''}
          onChange={(event) =>
            pushWith((params) => {
              if (event.target.value) params.set('minRating', event.target.value);
              else params.delete('minRating');
            })
          }
          data-testid="facet-min-rating"
        >
          <option value="">Toutes les notes</option>
          <option value="4">4 étoiles et plus</option>
          <option value="3">3 étoiles et plus</option>
        </select>
      </fieldset>
    </aside>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={id}
      />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}

function centsToEuroInput(value: string | null): string {
  if (!value) return '';
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(Math.round(parsed / 100)) : '';
}

function euroInputToCents(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed * 100;
}
