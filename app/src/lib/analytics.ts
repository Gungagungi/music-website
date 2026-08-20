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

/**
 * Empile une commande Matomo.
 *
 * La file est créée si elle n'existe pas encore, et c'est le point délicat : les
 * effets des composants s'exécutent à l'hydratation, l'amorçage du tracker juste
 * après. Une version antérieure écartait les commandes tant que `window._paq`
 * était absent, et le `setEcommerceView` des fiches produit n'atteignait donc
 * jamais Matomo — silencieusement, puisque c'est exactement ce que la garde
 * était censée faire.
 *
 * Empiler avant le chargement de matomo.js n'a rien d'un contournement : `_paq`
 * est une file que le tracker vide à son arrivée, et c'est le mode d'emploi
 * officiel. L'amorçage, lui, se préfixe à ce qui l'attend (voir Matomo.tsx),
 * de sorte que ses réglages précèdent toujours la première vue.
 *
 * Sur le serveur, ou si le tracker n'est jamais chargé, la file grossit de
 * quelques entrées puis disparaît avec la page.
 *
 * La commande est prise telle quelle, et surtout pas en paramètres du reste :
 * `push(...commande)` empilait `[['trackPageView']]` au lieu de
 * `['trackPageView']`, et matomo.js appelait `apply` sur un tableau plutôt que
 * sur une méthode. Le tracker mourait, et avec lui l'hydratation de la page —
 * `aB.apply is not a function`, dans du code minifié, sans rien qui désigne
 * l'appelant. La faute est restée invisible tant que la garde ci-dessus
 * écartait toutes les commandes : elle ne s'est déclarée qu'en réparant la
 * garde.
 */
export function push(commande: unknown[]): void {
  if (typeof window === 'undefined') return;
  (window._paq = window._paq ?? []).push(commande);
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
