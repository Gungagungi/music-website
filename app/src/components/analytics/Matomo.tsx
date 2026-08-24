import Script from 'next/script';
import { Suspense } from 'react';

import { SuiviDeNavigation } from './SuiviDeNavigation';

/**
 * Adresse de l'instance Matomo et identifiant du site, tous deux figés au build.
 *
 * `NEXT_PUBLIC_*` n'est pas lu à l'exécution : Next remplace l'expression par sa
 * valeur pendant `next build`. Changer l'URL ou le siteId impose donc de
 * reconstruire l'image (`docker compose up -d --build`), pas de redémarrer le
 * conteneur — même piège que NEXT_PUBLIC_SEED_BUGS. C'est la raison pour
 * laquelle l'expression est écrite en toutes lettres ici : un accès indirect
 * (`process.env[nom]`) ne serait pas substitué et vaudrait toujours undefined.
 */
const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL;
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;

/** Garantit l'unique barre oblique finale attendue par matomo.js. */
function baseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Tracker Matomo, sans cookie.
 *
 * `disableCookies` avant tout le reste : c'est ce qui dispense d'un bandeau de
 * consentement (l'anonymisation des adresses IP, elle, se règle côté serveur
 * Matomo, où le visiteur ne peut pas la contourner). Les deux réglages vont
 * ensemble — activer l'un sans l'autre ne rend pas la mesure exempte.
 *
 * Le composant ne rend rien tant que la configuration est absente : un
 * développement local n'a pas d'instance Matomo en face, et une requête vers un
 * hôte injoignable à chaque navigation n'apprendrait rien à personne.
 */
export function Matomo({ nonce }: { nonce?: string }) {
  if (!MATOMO_URL || !MATOMO_SITE_ID) return null;

  const base = baseUrl(MATOMO_URL);

  return (
    <>
      {/*
        L'amorçage se PRÉFIXE à la file au lieu de l'alimenter, et c'est tout
        l'intérêt de ce composant.

        Deux populations empilent dans `_paq` sans se connaître : cet extrait,
        qui porte les réglages, et les effets des composants, qui portent les
        vues et les événements e-commerce. Aucun ordre d'exécution ne peut être
        garanti entre les deux — `afterInteractive` place l'extrait après
        l'hydratation, donc après les effets. Un simple `push` laisserait alors
        `disableCookies` derrière la première vue de page, et cette vue-là
        serait enregistrée avec cookie : la promesse de dispense de bandeau
        tombe sur la première page de chaque visite.

        Préfixer rend la question sans objet. Les réglages passent devant quoi
        que ce soit qui attendait déjà, matomo.js vide la file dans l'ordre à son
        arrivée, et plus personne n'a à savoir qui s'est exécuté en premier.

        Deux autres pistes ont été essayées et écartées, chacune pour une raison
        qui ne se voit qu'à l'exécution. `beforeInteractive` est rangé par Next
        dans sa file `__next_s` et ne s'exécute jamais dans l'App Router. Une
        balise <script> inline rendue par React casse l'hydratation
        (`aB.apply is not a function`) : le HTML servi reste impeccable, et la
        page perd toute interactivité.

        Aucun `trackPageView` ici : SuiviDeNavigation l'émet, pour la première
        vue comme pour les suivantes.
      */}
      <Script id="matomo-init" strategy="afterInteractive" nonce={nonce}>
        {`
          (function() {
            var reglages = [
              ['disableCookies'],
              ['setTrackerUrl', ${JSON.stringify(`${base}matomo.php`)}],
              ['setSiteId', ${JSON.stringify(MATOMO_SITE_ID)}]
            ];
            window._paq = reglages.concat(window._paq || []);
            var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
            g.async = true; g.src = ${JSON.stringify(`${base}matomo.js`)};
            s.parentNode.insertBefore(g, s);
          })();
        `}
      </Script>

      <Suspense fallback={null}>
        <SuiviDeNavigation />
      </Suspense>
    </>
  );
}
