'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { SORT_OPTIONS } from '@/lib/search-params';

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-select" className="text-sm text-fg-muted">
        Trier par
      </label>
      <select
        id="sort-select"
        data-testid="sort-select"
        className="rounded border border-line bg-surface px-2 py-2 text-sm"
        value={searchParams.get('sort') ?? 'pertinence'}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === 'pertinence') params.delete('sort');
          else params.set('sort', event.target.value);
          params.delete('page');
          router.push(params.toString() ? `${pathname}?${params}` : pathname);
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
