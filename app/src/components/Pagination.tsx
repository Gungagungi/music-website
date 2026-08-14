import Link from 'next/link';

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" data-testid="pagination" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              className="rounded border border-ink-100 bg-white px-3 py-2 text-sm hover:border-amber-brand"
              data-testid="pagination-prev"
              rel="prev"
            >
              Précédent
            </Link>
          ) : (
            <span className="rounded border border-ink-100 px-3 py-2 text-sm text-ink-300" aria-disabled="true">
              Précédent
            </span>
          )}
        </li>

        {pages.map((candidate) => (
          <li key={candidate}>
            <Link
              href={buildHref(candidate)}
              aria-current={candidate === page ? 'page' : undefined}
              data-testid={`pagination-page-${candidate}`}
              className={
                candidate === page
                  ? 'rounded bg-ink-900 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded border border-ink-100 bg-white px-3 py-2 text-sm hover:border-amber-brand'
              }
            >
              {candidate}
            </Link>
          </li>
        ))}

        <li>
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              className="rounded border border-ink-100 bg-white px-3 py-2 text-sm hover:border-amber-brand"
              data-testid="pagination-next"
              rel="next"
            >
              Suivant
            </Link>
          ) : (
            <span className="rounded border border-ink-100 px-3 py-2 text-sm text-ink-300" aria-disabled="true">
              Suivant
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
