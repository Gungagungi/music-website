import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center" data-testid="not-found">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-brand">Erreur 404</p>
      <h1 className="mt-3 text-4xl font-bold">Cette page est introuvable.</h1>
      <p className="mt-4 text-fg-muted">
        Le produit ou la page que vous cherchez n’existe pas ou n’est plus disponible.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
        data-testid="not-found-home"
      >
        Retour à l’accueil
      </Link>
    </div>
  );
}
