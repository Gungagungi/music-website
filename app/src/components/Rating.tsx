export function Rating({ value, count }: { value: number; count: number }) {
  const rounded = Math.round(value);

  return (
    <p className="flex items-center gap-1 text-sm" data-testid="rating">
      <span aria-hidden="true" className="text-amber-brand tracking-tight">
        {'★'.repeat(rounded)}
        <span className="text-ink-300">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="sr-only">
        Note : {value.toFixed(1)} sur 5, basée sur {count} avis
      </span>
      <span aria-hidden="true" className="text-ink-500">
        {value.toFixed(1)} ({count})
      </span>
    </p>
  );
}
