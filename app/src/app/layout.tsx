import type { Metadata } from 'next';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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
      </body>
    </html>
  );
}
