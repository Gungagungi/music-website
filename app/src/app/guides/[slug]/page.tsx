import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumb } from '@/components/Breadcrumb';
import { ProductGrid } from '@/components/ProductGrid';
import { CATEGORY_BY_SLUG } from '@/data/categories';
import { GUIDES, GUIDE_BY_SLUG } from '@/data/guides';
import { queryProducts } from '@/lib/catalog';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Guides are static content, so their routes are generated at build time — the
 * one part of this shop that does not need a database to render.
 */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDE_BY_SLUG.get(slug);
  return {
    title: guide?.title ?? 'Guide introuvable',
    description: guide?.summary,
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = GUIDE_BY_SLUG.get(slug);
  if (!guide) notFound();

  const category = CATEGORY_BY_SLUG.get(guide.category);
  // The shelf the guide is about, best-sellers first: a guide that does not
  // lead back to the products it describes is a blog post, not a buying guide.
  const { items } = await queryProducts({ category: guide.category, sort: 'note', limit: 4 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8" data-testid="guide-page" data-slug={guide.slug}>
      <Breadcrumb
        trail={[
          { label: 'Accueil', href: '/' },
          { label: 'Guides d’achat', href: '/guides' },
          { label: guide.title },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold" data-testid="guide-title">
        {guide.title}
      </h1>
      <p className="mt-2 text-lg text-fg-muted">{guide.summary}</p>

      <div className="mt-8 space-y-8" data-testid="guide-body">
        {guide.sections.map((section) => (
          <section key={section.heading} data-testid="guide-section">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p className="mt-2 leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-12" aria-labelledby="guide-products-title">
        <h2 id="guide-products-title" className="text-2xl font-bold">
          Dans ce rayon
        </h2>
        <div className="mt-4">
          <ProductGrid products={items} testId="guide-products" />
        </div>
        <Link
          href={`/c/${guide.category}`}
          className="mt-4 inline-block underline hover:text-amber-brand"
          data-testid="guide-category-link"
        >
          Voir tout le rayon {category?.label ?? guide.category}
        </Link>
      </section>
    </div>
  );
}
