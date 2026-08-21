'use client';

import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

/**
 * Bascule entre thème clair et thème sombre.
 *
 * Le composant est volontairement **sans état React**. Le thème effectif au
 * chargement dépend de `localStorage` et de la préférence système, deux choses
 * que le serveur ne peut pas connaître : en faire un état rendu produirait soit
 * une divergence d'hydratation, soit un premier rendu au mauvais thème corrigé
 * après coup, c'est-à-dire le scintillement qu'on cherche à éviter.
 *
 * Le libellé et l'icône sont donc choisis par la cascade CSS (`--affichage-*`,
 * voir globals.css) à partir du thème réellement appliqué. Le HTML servi est le
 * même dans les deux cas, l'affichage est correct dès la première peinture, et
 * le nom accessible du bouton suit — le libellé masqué l'est par `display:none`,
 * donc il sort aussi de l'arbre d'accessibilité.
 */
export function ThemeToggle() {
  function basculer() {
    const racine = document.documentElement;
    const actuel: Theme =
      racine.dataset.theme === 'dark' || racine.dataset.theme === 'light'
        ? racine.dataset.theme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

    const suivant: Theme = actuel === 'dark' ? 'light' : 'dark';
    racine.dataset.theme = suivant;

    // Le choix explicite survit à la navigation ; l'absence de clé signifie
    // « suivre l'appareil », qui reste l'état par défaut tant que personne n'a
    // touché au bouton. Un navigateur qui refuse le stockage (mode privé
    // strict) ne doit pas empêcher la bascule de la page en cours.
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, suivant);
    } catch {
      /* thème appliqué quand même, simplement pas mémorisé */
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      className="theme-toggle flex items-center gap-2 rounded-md border border-ink-700 px-3 py-2 text-sm hover:border-amber-brand hover:text-amber-brand"
      data-testid="theme-toggle"
    >
      <span className="theme-toggle-clair" data-theme-libelle="clair">
        <IconeLune />
        Thème sombre
      </span>
      <span className="theme-toggle-sombre" data-theme-libelle="sombre">
        <IconeSoleil />
        Thème clair
      </span>
    </button>
  );
}

/* Icônes tracées plutôt qu'emoji : un emoji est rendu par une police différente
   selon la plateforme, ce qui décale la ligne de base et fait diverger les
   captures de référence sans qu'aucune régression n'ait eu lieu. */

function IconeLune() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="inline-block size-4 align-text-bottom"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function IconeSoleil() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="inline-block size-4 align-text-bottom"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
