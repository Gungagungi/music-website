'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { push } from '@/lib/analytics';

/**
 * Émet la vue de page, à l'entrée sur le site comme à chaque navigation.
 *
 * Next ne recharge pas la page d'une route à l'autre : sans ce composant,
 * Matomo n'enregistrerait que la toute première vue de la session.
 *
 * La première vue lui revient aussi, et pas à l'extrait d'amorçage, à cause de
 * l'e-commerce. `setEcommerceView` n'enregistre rien par lui-même : il arme la
 * *prochaine* vue de page. Il faut donc que la déclaration du produit précède
 * l'émission de la vue, sans quoi la fiche produit compte comme une page
 * ordinaire. React exécute les effets des enfants avant ceux des parents, et
 * `{children}` précède `<Matomo />` dans le layout : l'effet de
 * TrackProductView passe avant celui-ci, ce qui donne l'ordre voulu sans
 * coordination explicite. Si cet ordre venait à changer, la dégradation est
 * bénigne — une vue de page sans son volet e-commerce, jamais un doublon.
 *
 * `useSearchParams` est ce qui impose le `<Suspense>` du composant parent : sans
 * lui, toute page qui rend ce composant bascule en rendu dynamique.
 */
export function SuiviDeNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const precedente = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    // À l'entrée sur le site, le tracker lit lui-même l'URL et le référent du
    // document. Les lui réécrire n'apporterait rien et remplacerait un référent
    // externe — celui qui dit d'où vient le visiteur — par une page du site.
    if (precedente.current !== null) {
      push(['setReferrerUrl', new URL(precedente.current, window.location.origin).href]);
      push(['setCustomUrl', window.location.href]);
      push(['setDocumentTitle', document.title]);
    }

    push(['trackPageView']);
    // Les liens sortants et les téléchargements sont réattachés à chaque vue :
    // le DOM a été remplacé, les écouteurs posés sur l'ancien ont disparu.
    push(['enableLinkTracking']);

    precedente.current = url;
  }, [pathname, searchParams]);

  return null;
}
