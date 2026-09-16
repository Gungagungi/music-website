/**
 * Single boundary between the application and the Matomo tracker.
 *
 * Everything goes through `push()`, e-commerce calls included, and `push()` does
 * nothing when `window._paq` is absent. The tracker is loaded neither in the
 * test suite nor when the environment variables are not set: without this
 * choke point, every caller would have to repeat the same guard, and the day one
 * of them forgot, the page would break exactly where the tracker has no reason
 * to exist.
 *
 * `_paq` is a queue: Matomo drains it when matomo.js loads and replaces the
 * array with an object that executes immediately. Pushing before the script
 * loads is therefore not merely allowed, it is the intended usage.
 */

declare global {
  interface Window {
    _paq?: unknown[][];
  }
}

/**
 * Pushes a Matomo command.
 *
 * The queue is created if it does not exist yet, and that is the tricky part:
 * component effects run at hydration, the tracker bootstrap just after. An
 * earlier version dropped commands while `window._paq` was absent, so the
 * product pages' `setEcommerceView` never reached Matomo — silently, since that
 * is exactly what the guard was meant to do.
 *
 * Pushing before matomo.js loads is no workaround: `_paq` is a queue the tracker
 * drains on arrival, and that is the official usage. The bootstrap, for its
 * part, prepends itself to whatever is waiting (see Matomo.tsx), so its settings
 * always come before the first page view.
 *
 * On the server, or if the tracker is never loaded, the queue grows by a few
 * entries and then disappears with the page.
 *
 * The command is taken as-is, and above all not spread as parameters:
 * `push(...commande)` pushed `[['trackPageView']]` instead of
 * `['trackPageView']`, and matomo.js called `apply` on an array rather than on
 * a method. The tracker died, and page hydration with it —
 * `aB.apply is not a function`, in minified code, with nothing pointing at the
 * caller. The fault stayed invisible as long as the guard above dropped every
 * command: it only surfaced once the guard was fixed.
 */
export function push(commande: unknown[]): void {
  if (typeof window === 'undefined') return;
  (window._paq = window._paq ?? []).push(commande);
}

/**
 * Converts a domain amount into the unit Matomo expects.
 *
 * The whole repository counts in integer cents (lib/money.ts) and Matomo reasons
 * in decimal currency units. The division lives here, and nowhere else: it is
 * the only boundary where a float is legitimate, and an order of €1,299.00
 * recorded as €129,900 is the kind of mistake nobody notices until reading the
 * reports, weeks later.
 */
export function enUnitesMonetaires(centimes: number): number {
  return centimes / 100;
}
