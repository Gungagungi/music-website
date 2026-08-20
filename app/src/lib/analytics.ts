/**
 * Frontière unique entre l'application et le tracker Matomo.
 *
 * Tout passe par `push()`, y compris les appels e-commerce, et `push()` ne fait
 * rien quand `window._paq` est absent. Le tracker n'est chargé ni dans la suite
 * de tests ni quand les variables d'environnement ne sont pas renseignées : sans
 * ce point de passage, chaque appelant devrait refaire la même garde, et le jour
 * où l'un l'oublierait, la page casserait exactement là où le tracker n'a
 * aucune raison d'exister.
 *
 * `_paq` est une file : Matomo la vide au chargement de matomo.js et remplace le
 * tableau par un objet qui exécute immédiatement. Empiler avant le chargement du
 * script est donc non seulement permis, c'est le mode d'emploi.
 */

declare global {
  interface Window {
    _paq?: unknown[][];
  }
}

/** Empile une commande Matomo, ou ne fait rien si le tracker n'est pas là. */
export function push(...commande: unknown[]): void {
  if (typeof window === 'undefined' || !window._paq) return;
  window._paq.push(commande);
}

/**
 * Convertit un montant du domaine vers l'unité que Matomo attend.
 *
 * Tout le dépôt compte en centimes entiers (lib/money.ts) et Matomo raisonne en
 * unités monétaires décimales. La division vit ici, et nulle part ailleurs :
 * c'est la seule frontière où un flottant est légitime, et une commande à
 * 1 299,00 € enregistrée à 129 900 € est le genre d'erreur qu'on ne remarque
 * qu'au moment de lire les rapports, des semaines plus tard.
 */
export function enUnitesMonetaires(centimes: number): number {
  return centimes / 100;
}
