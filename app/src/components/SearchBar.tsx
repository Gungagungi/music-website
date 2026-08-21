'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') ?? '');

  return (
    <form
      role="search"
      data-testid="search-form"
      className="flex w-full items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = term.trim();
        router.push(trimmed ? `/recherche?q=${encodeURIComponent(trimmed)}` : '/recherche');
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        Rechercher un produit
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Rechercher une guitare, un ampli, une pédale…"
        className="w-full rounded-md border border-ink-700 bg-surface px-3 py-2 text-fg placeholder:text-fg-muted"
        data-testid="search-input"
      />
      <button
        type="submit"
        className="rounded-md border border-amber-brand px-4 py-2 text-sm font-semibold text-amber-brand hover:bg-amber-brand hover:text-ink-950"
        data-testid="search-submit"
      >
        Rechercher
      </button>
    </form>
  );
}
