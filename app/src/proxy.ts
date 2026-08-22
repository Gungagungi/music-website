import { NextResponse, type NextRequest } from 'next/server';

/**
 * Politique de sécurité du contenu (CSP), à nonce par requête.
 *
 * Jusqu'ici la seule directive servie était `frame-ancestors 'none'`, posée par
 * Caddy. Elle interdit le cadrage, et rien d'autre : sans `default-src` ni
 * `script-src`, une injection de balise `<script>` s'exécutait sans obstacle.
 * Un audit l'a relevé.
 *
 * Le nonce est indispensable plutôt que confortable : l'en-tête ne peut pas
 * être statique parce que ce document contient un script inline — l'amorçage du
 * thème, qui doit s'exécuter dans `<head>` avant la première peinture pour
 * éviter le sursaut de thème (voir lib/theme.ts). Le figer par un `sha256-`
 * conviendrait à celui-là seul, mais pas aux scripts que Next injecte pour
 * l'hydratation, dont le contenu change à chaque build.
 *
 * `strict-dynamic` fait le reste : un script porteur du nonce transmet sa
 * confiance à ceux qu'il crée. C'est ce qui laisse matomo.js s'installer — il
 * est inséré par `document.createElement('script')` depuis l'amorçage Matomo
 * (components/analytics/Matomo.tsx) — sans avoir à autoriser son hôte, et sans
 * qu'une liste d'hôtes autorisés ne devienne le contournement habituel.
 *
 * Ce fichier s'appelle `proxy.ts` et non `middleware.ts` : la convention a été
 * renommée dans Next 16, l'ancien nom est déprécié.
 */

/**
 * Figée au build comme partout ailleurs dans ce dépôt — `NEXT_PUBLIC_*` est
 * substitué par `next build`, y compris ici. L'expression est écrite en toutes
 * lettres pour cette raison : un accès indirect ne serait pas remplacé.
 */
const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL;

/** L'origine de Matomo, ou rien si la mesure d'audience n'est pas configurée. */
function matomoOrigin(): string {
  if (!MATOMO_URL) return '';
  try {
    return new URL(MATOMO_URL).origin;
  } catch {
    return '';
  }
}

function policy(nonce: string): string {
  const matomo = matomoOrigin();
  const developpement = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    // `unsafe-eval` uniquement en développement : React s'en sert pour
    // reconstruire les piles d'erreur serveur dans le navigateur. Ni React ni
    // Next n'en ont besoin en production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developpement ? " 'unsafe-eval'" : ''}`,
    // `unsafe-inline` assumé pour les styles, et pas par facilité : React pose
    // des attributs `style=` sur les éléments, que `style-src-attr` ne sait
    // autoriser qu'ainsi — un nonce ne couvre que les balises `<style>`. La
    // directive qui compte contre l'injection de code est `script-src`, et
    // elle, elle est stricte.
    "style-src 'self' 'unsafe-inline'",
    // `data:` couvre les SVG produits à la volée par images/product/[slug].
    `img-src 'self' data: blob:${matomo ? ` ${matomo}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${matomo ? ` ${matomo}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Remplace X-Frame-Options, qui ne sait pas exprimer autre chose que
    // « jamais » ou « même origine ».
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = policy(nonce);

  // Le nonce voyage par un en-tête de requête : c'est ainsi que le layout le
  // récupère (`headers().get('x-nonce')`) pour le poser sur le script de thème
  // et sur l'amorçage Matomo.
  const enTetes = new Headers(request.headers);
  enTetes.set('x-nonce', nonce);
  enTetes.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: enTetes } });
  response.headers.set('Content-Security-Policy', csp);

  // Aucune de ces fonctionnalités n'est utilisée par la boutique. Les refuser
  // explicitement évite qu'un script tiers introduit plus tard puisse les
  // demander sans que personne ne s'en aperçoive.
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  /**
   * Tout, sauf les fichiers servis tels quels.
   *
   * Les ressources de `_next/static` sont immuables et mises en cache par le
   * navigateur comme par le proxy : leur faire traverser ce module coûterait un
   * nonce recalculé pour un en-tête que personne ne lit sur une réponse de
   * fichier. `_next/image` est exclu pour la même raison.
   */
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
