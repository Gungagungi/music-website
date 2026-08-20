'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { push } from '@/lib/analytics';

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
 * Suivi des navigations côté client.
 *
 * Next ne recharge pas la page d'une route à l'autre : sans ce composant,
 * Matomo n'enregistrerait que la toute première vue de la session. La vue
 * initiale, elle, est déclenchée par l'extrait d'amorçage — d'où le saut du
 * premier passage, qui produirait sinon un doublon sur chaque entrée sur le
 * site.
 *
 * `useSearchParams` est ce qui impose le `<Suspense>` du composant parent : sans
 * lui, toute page qui rend ce composant bascule en rendu dynamique.
 */
function SuiviDeNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const precedente = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    if (precedente.current === null) {
      precedente.current = url;
      return;
    }

    push(['setReferrerUrl', new URL(precedente.current, window.location.origin).href]);
    push(['setCustomUrl', window.location.href]);
    push(['setDocumentTitle', document.title]);
    push(['trackPageView']);
    // Les liens sortants et les téléchargements sont réattachés à chaque vue :
    // le DOM a été remplacé, les écouteurs posés sur l'ancien ont disparu.
    push(['enableLinkTracking']);

    precedente.current = url;
  }, [pathname, searchParams]);

  return null;
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
export function Matomo() {
  if (!MATOMO_URL || !MATOMO_SITE_ID) return null;

  const base = baseUrl(MATOMO_URL);

  return (
    <>
      {/*
        Extrait officiel, inline et volontairement pas remplacé par un effet :
        `_paq` doit exister et porter ses réglages avant que matomo.js ne vide la
        file, et c'est lui qui insère la balise de chargement. Un `<Script src>`
        séparé laisserait l'ordre des deux à la merci de la stratégie choisie.
      */}
      <Script id="matomo-init" strategy="afterInteractive">
        {`
          var _paq = window._paq = window._paq || [];
          _paq.push(['disableCookies']);
          _paq.push(['trackPageView']);
          _paq.push(['enableLinkTracking']);
          (function() {
            _paq.push(['setTrackerUrl', ${JSON.stringify(`${base}matomo.php`)}]);
            _paq.push(['setSiteId', ${JSON.stringify(MATOMO_SITE_ID)}]);
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
