#!/usr/bin/env node
/**
 * Écrit `perf/baseline.json` depuis les résumés k6 d'un run de calibration.
 *
 * Le fichier n'est jamais rédigé à la main : une valeur posée au jugé produit un
 * seuil qui ne mesure plus rien, et personne ne peut relire un nombre pour
 * décider s'il vient d'une machine ou d'une intuition. Ce script ne sait donc
 * que recopier ce que k6 a mesuré, en notant où et quand.
 *
 *   node scripts/enregistrer-baseline.mjs smoke load
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const CIBLE = resolve(RACINE, 'perf/baseline.json');

/** Les métriques dont on dérive un seuil, par scénario. Le reste n'est pas mesuré. */
const METRIQUES = {
  smoke: ['http_req_duration', 'group_duration{group:::Catalogue}'],
  load: ['http_req_duration', 'cart_add_duration'],
};

const STATISTIQUES = ['p(95)', 'p(99)'];

function mesuresDe(scenario) {
  const chemin = resolve(RACINE, `perf/results/${scenario}.json`);
  let brut;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (cause) {
    throw new Error(
      `Aucun résumé lisible pour « ${scenario} » (${chemin}). ` +
        'Lancer le scénario en calibration avant d’enregistrer.',
      { cause },
    );
  }

  const mesures = {};
  for (const nom of METRIQUES[scenario] ?? []) {
    const valeurs = brut.metrics?.[nom]?.values;
    if (!valeurs) {
      // Une métrique absente est un scénario qui a changé sans que ce script le
      // sache. L'ignorer écrirait une baseline partielle, dont les seuils
      // manquants retomberaient silencieusement sur les valeurs héritées.
      throw new Error(`Métrique « ${nom} » absente du résumé de « ${scenario} ».`);
    }
    mesures[nom] = Object.fromEntries(
      STATISTIQUES.filter((s) => typeof valeurs[s] === 'number').map((s) => [
        s,
        Number(valeurs[s].toFixed(2)),
      ]),
    );
  }
  return mesures;
}

const scenarios = process.argv.slice(2);
if (scenarios.length === 0) {
  console.error('Usage : node scripts/enregistrer-baseline.mjs <scenario…>');
  process.exit(1);
}

const existant = JSON.parse(readFileSync(CIBLE, 'utf8'));
const baseline = {
  ...existant,
  mesureLe: new Date().toISOString().slice(0, 10),
  runner: process.env.RUNNER_DESCRIPTION ?? process.env.RUNNER_OS ?? 'inconnu',
  commit: process.env.GITHUB_SHA ?? null,
  scenarios: { ...existant.scenarios },
};

for (const scenario of scenarios) {
  baseline.scenarios[scenario] = mesuresDe(scenario);
}

writeFileSync(CIBLE, `${JSON.stringify(baseline, null, 2)}\n`);

console.log(`Baseline écrite dans ${CIBLE} :`);
for (const [scenario, mesures] of Object.entries(baseline.scenarios)) {
  for (const [metrique, statistiques] of Object.entries(mesures)) {
    const detail = Object.entries(statistiques)
      .map(([s, v]) => `${s} ${v} ms`)
      .join(' · ');
    console.log(`  ${scenario} — ${metrique} : ${detail}`);
  }
}
