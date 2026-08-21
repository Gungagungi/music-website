import Link from 'next/link';

import { CATEGORIES } from '@/data/categories';

/**
 * One deliberately seeded defect, gated behind SEED_BUGS=1.
 * See docs/bug-reports/BUG-003-missing-form-labels.md — the newsletter input
 * loses every source of an accessible name (no label, no aria-label, and no
 * placeholder either, since axe accepts a placeholder as a last-resort name).
 * axe reports it as a WCAG 4.1.2 / 3.3.2 failure.
 */
const MISSING_LABEL_BUG_ENABLED = process.env.SEED_BUGS === '1';

export function Footer() {
  return (
    <footer className="mt-16 bg-chrome text-ink-300" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-white">Fretline</p>
          <p className="mt-2 text-sm">
            Boutique de démonstration dédiée aux guitares, basses et à l’amplification. Aucun produit
            n’est réellement vendu sur ce site.
          </p>
        </div>

        <nav aria-label="Catégories">
          <p className="font-semibold text-white">Nos rayons</p>
          <ul className="mt-3 space-y-1 text-sm">
            {CATEGORIES.slice(0, 5).map((category) => (
              <li key={category.slug}>
                <Link href={`/c/${category.slug}`} className="hover:text-amber-brand">
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Informations">
          <p className="font-semibold text-white">Informations</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Livraison offerte dès 199 €</li>
            <li>Retour sous 30 jours</li>
            <li>Garantie 3 ans</li>
            <li>Paiement sécurisé</li>
          </ul>
        </nav>

        <div>
          <p className="font-semibold text-white">Newsletter</p>
          <form className="mt-3 flex flex-col gap-2" data-testid="newsletter-form">
            {MISSING_LABEL_BUG_ENABLED ? (
              <input
                type="email"
                className="rounded-md border border-ink-700 bg-chrome-alt px-3 py-2 text-white placeholder:text-ink-500"
                data-testid="newsletter-email"
              />
            ) : (
              <>
                <label htmlFor="newsletter-email" className="text-sm">
                  Votre adresse e-mail
                </label>
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  className="rounded-md border border-ink-700 bg-chrome-alt px-3 py-2 text-white placeholder:text-ink-500"
                  data-testid="newsletter-email"
                />
              </>
            )}
            <button
              type="submit"
              className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
            >
              S’inscrire
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-ink-800 px-4 py-6 text-center text-xs">
        Fretline — projet fictif à usage pédagogique et de démonstration QA.
      </div>
    </footer>
  );
}
