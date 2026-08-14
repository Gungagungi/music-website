import Link from 'next/link';

import { ProductGrid } from '@/components/ProductGrid';
import { CATEGORIES } from '@/data/categories';
import { bestSellers, categoryCounts, hotDeals, newArrivals } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const counts = new Map(categoryCounts().map((entry) => [entry.slug, entry.count]));
  const sellers = bestSellers(8);
  const arrivals = newArrivals(8);
  const deals = hotDeals(8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section
        className="rounded-2xl bg-ink-900 px-6 py-12 text-white sm:px-12"
        data-testid="hero"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-brand">
          Guitares · Basses · Amplification
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          Tout pour brancher, jouer et sonner juste.
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">
          Plus de {counts.size ? [...counts.values()].reduce((sum, value) => sum + value, 0) : 0}{' '}
          références en stock, de la guitare d’étude au matériel de scène. Livraison offerte dès
          199 €, retour sous 30 jours.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/c/guitares-electriques"
            className="rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
            data-testid="hero-cta-primary"
          >
            Voir les guitares électriques
          </Link>
          <Link
            href="/c/pedales-effets"
            className="rounded-md border border-ink-700 px-5 py-3 font-semibold hover:border-amber-brand"
            data-testid="hero-cta-secondary"
          >
            Explorer les pédales
          </Link>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="rayons-title">
        <h2 id="rayons-title" className="text-2xl font-bold">
          Nos rayons
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5" data-testid="category-tiles">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/c/${category.slug}`}
                className="flex h-full flex-col justify-between rounded-lg border border-ink-100 bg-white p-4 hover:border-amber-brand"
                data-testid={`category-tile-${category.slug}`}
              >
                <span className="font-semibold">{category.label}</span>
                <span className="mt-2 text-xs text-ink-500">
                  {counts.get(category.slug) ?? 0} références
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <HomeSection id="best-sellers" title="Meilleures ventes" products={sellers} />
      <HomeSection id="new-arrivals" title="Nouveautés" products={arrivals} />
      <HomeSection id="hot-deals" title="Hot deals" products={deals} />
    </div>
  );
}

function HomeSection({
  id,
  title,
  products,
}: {
  id: string;
  title: string;
  products: Parameters<typeof ProductGrid>[0]['products'];
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby={`${id}-title`} data-testid={`section-${id}`}>
      <h2 id={`${id}-title`} className="text-2xl font-bold">
        {title}
      </h2>
      <div className="mt-4">
        <ProductGrid products={products} testId={`grid-${id}`} />
      </div>
    </section>
  );
}
