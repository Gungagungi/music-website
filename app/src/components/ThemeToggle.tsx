'use client';

import { THEME_STORAGE_KEY, nextTheme, type ThemeChoice } from '@/lib/theme';

/**
 * Bouton de thème : cycle Système → Clair → Sombre → Système.
 *
 * Le composant est volontairement **sans état React**. Le thème effectif au
 * chargement dépend de `localStorage` et de la préférence système, deux choses
 * que le serveur ne peut pas connaître : en faire un état rendu produirait soit
 * une divergence d'hydratation, soit un premier rendu au mauvais thème corrigé
 * après coup, c'est-à-dire le scintillement qu'on cherche à éviter.
 *
 * Les trois libellés sont donc tous rendus, et la cascade n'en laisse voir
 * qu'un (`--affichage-theme-*`, voir globals.css). Le HTML servi est le même
 * dans les trois cas, l'affichage est correct dès la première peinture, et le
 * nom accessible du bouton suit — les libellés masqués le sont par
 * `display: none`, donc ils sortent aussi de l'arbre d'accessibilité.
 */
export function ThemeToggle() {
  function avancer() {
    const racine = document.documentElement;
    const stocke = racine.dataset.theme;
    const actuel: ThemeChoice = stocke === 'dark' || stocke === 'light' ? stocke : 'system';
    const suivant = nextTheme(actuel);

    if (suivant === 'system') delete racine.dataset.theme;
    else racine.dataset.theme = suivant;

    // Le choix explicite survit à la navigation ; l'absence de clé signifie
    // « suivre l'appareil ». Un navigateur qui refuse le stockage (mode privé
    // strict) ne doit pas empêcher la bascule de la page en cours.
    try {
      if (suivant === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, suivant);
    } catch {
      /* thème appliqué quand même, simplement pas mémorisé */
    }
  }

  return (
    <button
      type="button"
      onClick={avancer}
      className="flex items-center rounded-md border border-ink-700 px-3 py-2 text-sm hover:border-amber-brand hover:text-amber-brand"
      data-testid="theme-toggle"
    >
      {/* Le nom accessible du bouton serait « Sombre » sans ce préfixe, ce qui
          ne dit ni de quoi il s'agit ni qu'on peut en changer. */}
      <span className="sr-only">Thème d’affichage : </span>
      <span className="theme-mode-systeme" data-mode="system">
        <IconeSysteme />
        Système
      </span>
      <span className="theme-mode-clair" data-mode="light">
        <IconeSoleil />
        Clair
      </span>
      <span className="theme-mode-sombre" data-mode="dark">
        <IconeLune />
        Sombre
      </span>
    </button>
  );
}

/* Icônes tracées plutôt qu'emoji : un emoji est rendu par une police différente
   selon la plateforme, ce qui décale la ligne de base et fait diverger les
   captures de référence sans qu'aucune régression n'ait eu lieu. */

const COMMUN = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  className: 'inline-block size-4 align-text-bottom',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function IconeSysteme() {
  return (
    <svg {...COMMUN}>
      <circle cx="12" cy="12" r="9" />
      {/* Moitié pleine : le disque mi-clair mi-sombre est la convention pour
          « ni l'un ni l'autre, c'est l'appareil qui décide ». */}
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeSoleil() {
  return (
    <svg {...COMMUN}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconeLune() {
  return (
    <svg {...COMMUN}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
