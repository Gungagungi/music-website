/**
 * Display theme.
 *
 * Three states, one of which is not a colour: `system` means "follow the
 * device", and it is distinguished from the other two by the **absence** of a
 * stored choice. That is what lets all the logic fit in the cascade — the
 * default state is the `:root` selector with no attribute, the other two are
 * `:root[data-theme='light']` and `:root[data-theme='dark']`.
 *
 * The cycle goes back through `system` rather than bouncing between light and
 * dark: without it, a visitor who had touched the button just once could never
 * return to following their device without clearing their browser storage, and
 * nothing in the interface would tell them so.
 */
export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

export const THEME_STORAGE_KEY = 'fretline-theme';

/** Order of the toggle button's cycle. */
export const THEME_CYCLE: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function nextTheme(current: ThemeChoice): ThemeChoice {
  const index = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

/**
 * Script that re-applies the theme on `<html>` before first paint.
 *
 * It only exists for the explicit choice: automatic detection does not take a
 * single line of JavaScript. Making it blocking in `<head>` is precisely what
 * prevents the theme flash — a `next/script` with `afterInteractive` would run
 * after paint, hence too late, and `beforeInteractive` is never executed in the
 * App Router (see the comment in components/analytics/Matomo.tsx).
 *
 * The `try` covers browsers that throw on merely reading `localStorage`: an
 * exception here would stop the script at the head of the document, before
 * everything else.
 */
export const THEME_BOOTSTRAP_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
