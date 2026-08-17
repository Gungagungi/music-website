'use client';

import { useEffect } from 'react';

/**
 * Signale que la page est hydratée, donc réellement interactive.
 *
 * Entre l'arrivée du HTML rendu côté serveur et la fin de l'hydratation, les
 * champs contrôlés acceptent la saisie mais React les réinitialise au premier
 * re-rendu, et les gestionnaires d'événements ne sont pas encore attachés. Un
 * automate est assez rapide pour tomber dans cette fenêtre ; un humain sur une
 * connexion lente aussi.
 *
 * L'attribut posé ici donne un point d'attente explicite, à la place des
 * temporisations arbitraires qu'on finit toujours par écrire — et par
 * rallonger — quand aucun signal n'existe. Il est inerte en production :
 * `document.documentElement` porte un attribut de plus, rien d'autre.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  return null;
}
