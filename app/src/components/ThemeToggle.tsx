'use client';

import { THEME_STORAGE_KEY, nextTheme, type ThemeChoice } from '@/lib/theme';

/**
 * Theme button: cycles System → Light → Dark → System.
 *
 * The component is deliberately **free of React state**. The effective theme on
 * load depends on `localStorage` and on the system preference, two things the
 * server cannot know: making it rendered state would produce either a hydration
 * mismatch or a first render in the wrong theme corrected afterwards, that is,
 * the very flash we are trying to avoid.
 *
 * All three labels are therefore rendered, and the cascade lets only one of
 * them show (`--affichage-theme-*`, see globals.css). The served HTML is the
 * same in all three cases, the display is correct from first paint, and the
 * button's accessible name follows — hidden labels are hidden with
 * `display: none`, so they also leave the accessibility tree.
 */
export function ThemeToggle() {
  function avancer() {
    const racine = document.documentElement;
    const stocke = racine.dataset.theme;
    const actuel: ThemeChoice = stocke === 'dark' || stocke === 'light' ? stocke : 'system';
    const suivant = nextTheme(actuel);

    if (suivant === 'system') delete racine.dataset.theme;
    else racine.dataset.theme = suivant;

    // The explicit choice survives navigation; a missing key means "follow the
    // device". A browser that refuses storage (strict private mode) must not
    // prevent the current page from switching.
    try {
      if (suivant === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, suivant);
    } catch {
      /* theme applied anyway, just not remembered */
    }
  }

  return (
    <button
      type="button"
      onClick={avancer}
      className="flex items-center rounded-md border border-ink-700 px-3 py-2 text-sm hover:border-amber-brand hover:text-amber-brand"
      data-testid="theme-toggle"
    >
      {/* Without this prefix the button's accessible name would be "Sombre",
          which says neither what it is about nor that it can be changed. */}
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

/* Drawn icons rather than emoji: an emoji is rendered by a different font on
   each platform, which shifts the baseline and makes reference screenshots
   diverge without any regression having happened. */

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
      {/* Half filled: the half-light, half-dark disc is the convention for
          "neither one nor the other, the device decides". */}
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
