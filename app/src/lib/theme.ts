/**
 * Thème d'affichage : ce que le visiteur a explicitement choisi.
 *
 * L'absence de valeur stockée n'est pas un troisième thème, c'est l'état par
 * défaut « suivre l'appareil » — et il est traité entièrement par CSS
 * (`color-scheme: light dark` et les `light-dark()` de globals.css), sans
 * qu'aucun code d'application n'ait à lire la préférence système.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fretline-theme';

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
