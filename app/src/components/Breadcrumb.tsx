import Link from 'next/link';

export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" data-testid="breadcrumb" className="text-sm text-fg-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-center gap-1">
            {step.href ? (
              <Link href={step.href} className="hover:text-amber-brand">
                {step.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-fg">
                {step.label}
              </span>
            )}
            {index < trail.length - 1 && <span aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
