/**
 * Tests de mutation sur l'arithmétique monétaire.
 *
 * Une suite verte dit qu'aucun test n'échoue ; elle ne dit pas qu'un test
 * échouerait si le code devenait faux. Stryker pose la question directement :
 * il remplace `>=` par `>`, `Math.round` par `Math.floor`, un `+` par un `-`,
 * et compte les mutants que la suite laisse passer. Sur les prix, un mutant
 * survivant est un centime que personne ne réclamera.
 *
 * Le périmètre est volontairement minuscule. Ce n'est pas une couverture du
 * dépôt : c'est `money.ts`, et les fonctions pures de `cart.ts` — celles qui
 * décident d'un montant. Le reste de `cart.ts` parle à la base, ne se prête pas
 * à une suite unitaire rapide, et reste couvert par la suite d'API.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mts' },
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },

  // Les plages de lignes suivent la section « Pure pricing » de `cart.ts`. Si
  // le code pur y est déplacé ou étendu sans mettre cette plage à jour, le
  // score chute et la CI le dit — l'oubli se signale au lieu de s'installer.
  mutate: ['src/lib/money.ts', 'src/lib/cart.ts:44-48', 'src/lib/cart.ts:72-149'],

  // 100 % ou rien : sur ce périmètre, un mutant survivant désigne une règle
  // d'arrondi que rien ne tient. Le seuil est tenable parce que le périmètre
  // est petit — c'est le prix à payer pour qu'il reste un signal.
  thresholds: { high: 100, low: 100, break: 100 },
  timeoutMS: 20000,
};

export default config;
