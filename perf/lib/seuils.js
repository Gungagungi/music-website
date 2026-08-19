/**
 * Seuils dérivés d'une mesure prise sur le runner CI.
 *
 * Les seuils de ce dépôt étaient calibrés sur un VPS — la machine de celui qui
 * les a écrits. Un runner GitHub partagé est plus lent et surtout plus variable,
 * si bien qu'un seuil calé sur une autre machine ne dit plus rien : trop large,
 * il ne détecte rien ; trop serré, il rougit sur le bruit du voisinage.
 *
 * `baseline.json` est donc produit par le workflow « Mesurer la baseline de
 * performance », qui exécute les mêmes scripts sur le runner et y écrit les
 * mesures. C'est le même principe que les baselines visuelles : la référence
 * appartient à l'environnement qui la compare.
 *
 * Tant qu'aucune mesure n'existe, `defaut` s'applique — les valeurs historiques,
 * pour que la suite reste utilisable sans avoir à lancer la calibration d'abord.
 */
const baseline = JSON.parse(open('../baseline.json'));

/** Mode calibration : mesurer sans seuil, sinon le run à calibrer échoue sur les seuils qu'il sert à produire. */
export const CALIBRATION = __ENV.K6_CALIBRATION === '1';

export function mesure(scenario, metrique, statistique) {
  const valeur = baseline.scenarios?.[scenario]?.[metrique]?.[statistique];
  return typeof valeur === 'number' ? valeur : null;
}

/**
 * Seuil = `facteur` × la mesure, jamais moins que `plancher`.
 *
 * Le plancher n'est pas une précaution de style : les mesures se comptent en
 * dizaines de millisecondes, et cinq fois 12 ms font un seuil de 60 ms qu'une
 * pause du ramasse-miettes suffit à franchir. Il fixe le bruit qu'on accepte de
 * ne pas voir, en dessous duquel multiplier n'a plus de sens.
 */
export function seuil(scenario, metrique, statistique, { facteur, plancher, defaut }) {
  const valeur = mesure(scenario, metrique, statistique);
  if (valeur === null) return defaut;
  return Math.max(Math.round(facteur * valeur), plancher);
}

/** `p(95)<250` — l'expression que k6 attend, construite depuis la mesure. */
export function expression(scenario, metrique, statistique, bornes) {
  return `${statistique}<${seuil(scenario, metrique, statistique, bornes)}`;
}

/** Ce que le résumé doit dire de la provenance des seuils, mesurés ou hérités. */
export function provenance(scenario) {
  const mesures = baseline.scenarios?.[scenario];
  if (!mesures) return 'seuils hérités — aucune mesure de référence sur le runner CI';
  return `seuils dérivés de la mesure du ${baseline.mesureLe} sur ${baseline.runner}`;
}
