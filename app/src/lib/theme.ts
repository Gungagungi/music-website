/**
 * Thème d'affichage.
 *
 * Trois états, dont un qui n'est pas une couleur : `system` signifie « suivre
 * l'appareil », et il se distingue des deux autres par l'**absence** de choix
 * stocké. C'est ce qui permet à toute la logique de tenir dans la cascade —
 * l'état par défaut est le sélecteur `:root` sans attribut, les deux autres
 * sont `:root[data-theme='light']` et `:root[data-theme='dark']`.
 *
 * Le cycle repasse par `system` plutôt que de faire l'aller-retour entre clair
 * et sombre : sans lui, un visiteur ayant touché le bouton une seule fois ne
 * pourrait plus jamais revenir au suivi de son appareil sans vider le stockage
 * de son navigateur, et rien dans l'interface ne le lui dirait.
 */
export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

export const THEME_STORAGE_KEY = 'fretline-theme';

/** Ordre du cycle du bouton de bascule. */
export const THEME_CYCLE: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function nextTheme(current: ThemeChoice): ThemeChoice {
  const index = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

/**
 * Script reposé sur `<html>` avant la première peinture.
 *
 * Il n'existe que pour le choix explicite : la détection automatique, elle, ne
 * demande pas une ligne de JavaScript. Le rendre bloquant dans `<head>` est
 * précisément ce qui empêche le sursaut de thème — un `next/script` en
 * `afterInteractive` s'exécuterait après la peinture, donc trop tard, et
 * `beforeInteractive` n'est jamais exécuté dans l'App Router (voir le
 * commentaire de components/analytics/Matomo.tsx).
 *
 * Le `try` couvre les navigateurs qui lèvent à la simple lecture de
 * `localStorage` : une exception ici interromprait le script en tête de
 * document, avant tout le reste.
 */
export const THEME_BOOTSTRAP_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
