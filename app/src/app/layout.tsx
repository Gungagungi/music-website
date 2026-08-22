import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HydrationMarker } from '@/components/HydrationMarker';
import { Matomo } from '@/components/analytics/Matomo';
import { isTestMode } from '@/lib/deployment';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Fretline — Guitares, basses et amplification',
    template: '%s | Fretline',
  },
  description:
    'Fretline, la boutique de démonstration dédiée aux guitares, basses, amplis et accessoires. Projet fictif de portfolio QA.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce de la CSP, produit par requête dans proxy.ts. Il autorise les deux
  // seuls scripts inline du document — l'amorçage du thème et celui de Matomo —
  // sans ouvrir `script-src` à tout le reste.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="fr">
      <head>
        {/*
          Repose le choix explicite de thème avant la première peinture.

          Ce <script> est rendu par React, ce qui a déjà mal tourné dans ce
          dépôt — une balise inline placée dans le corps du document avait cassé
          l'hydratation. La différence tient à l'emplacement : dans <head>, le
          script s'exécute pendant l'analyse du document, avant que React ne
          touche au DOM, et il ne modifie qu'un attribut de <html> — que React
          ne rend pas et ne réconcilie donc pas.

          Il ne sert qu'au choix explicite : la détection du thème de l'appareil
          est purement CSS (globals.css), donc elle fonctionne aussi quand ce
          script est bloqué.
        */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas font-sans text-fg antialiased">
        <a href="#contenu" className="skip-link">
          Aller au contenu principal
        </a>
        <Header />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <Footer />
        <HydrationMarker />
        {/*
          Le tracker est absent de la suite, et la garde est ici plutôt que dans
          le composant : le script n'existe alors pas dans le HTML servi à
          Playwright, donc aucune requête réseau tierce ne vient s'intercaler
          entre deux assertions, ni décaler un rendu comparé au pixel près.
          `E2E_TEST_MODE` est le même discriminant que pour les endpoints de
          test (lib/deployment.ts) — pas NODE_ENV, qui vaut « production » dans
          la suite comme sur un déploiement.
        */}
        {!isTestMode() && <Matomo nonce={nonce} />}
      </body>
    </html>
  );
}
