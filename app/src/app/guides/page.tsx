import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { CATEGORY_BY_SLUG } from '@/data/categories';
import { GUIDES } from '@/data/guides';

export const metadata: Metadata = {
  title: 'Guides d’achat',
  description: 'Nos guides pour choisir un instrument, des cordes ou un ampli.',
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Guides d’achat' }]} />

      <h1 className="mt-4 text-3xl font-bold" data-testid="guides-title">
        Guides d’achat
      </h1>
      <p className="mt-2 text-fg-muted">
        Ce qui compte vraiment au moment de choisir, rayon par rayon.
      </p>

      <ul className="mt-8 space-y-4" data-testid="guide-list" data-count={GUIDES.length}>
        {GUIDES.map((guide) => (
          <li
            key={guide.slug}
            className="rounded-lg border border-line bg-surface p-5"
            data-testid="guide-card"
            data-slug={guide.slug}
          >
            <p className="text-xs uppercase tracking-wide text-fg-muted">
              {CATEGORY_BY_SLUG.get(guide.category)?.label ?? guide.category}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              <Link href={`/guides/${guide.slug}`} className="hover:text-amber-brand">
                {guide.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-fg-muted">{guide.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
