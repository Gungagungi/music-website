import type { Metadata } from 'next';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HydrationMarker } from '@/components/HydrationMarker';
import { Matomo } from '@/components/analytics/Matomo';
import { isTestMode } from '@/lib/deployment';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Fretline — Guitares, basses et amplification',
    template: '%s | Fretline',
  },
  description:
    'Fretline, la boutique de démonstration dédiée aux guitares, basses, amplis et accessoires. Projet fictif de portfolio QA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col font-sans antialiased">
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
        {!isTestMode() && <Matomo />}
      </body>
    </html>
  );
}
