#!/usr/bin/env node
/**
 * Writes `perf/baseline.json` from the k6 summaries of a calibration run.
 *
 * The file is never written by hand: a value set by guesswork produces a
 * threshold that no longer measures anything, and nobody can read a number back
 * and tell whether it came from a machine or a hunch. This script therefore only
 * knows how to copy what k6 measured, noting where and when.
 *
 *   node scripts/enregistrer-baseline.mjs smoke load
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const CIBLE = resolve(RACINE, 'perf/baseline.json');

/** The metrics a threshold is derived from, per scenario. The rest is not measured. */
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
      `No readable summary for "${scenario}" (${chemin}). ` +
        'Run the scenario in calibration mode before recording.',
      { cause },
    );
  }

  const mesures = {};
  for (const nom of METRIQUES[scenario] ?? []) {
    const valeurs = brut.metrics?.[nom]?.values;
    if (!valeurs) {
      // A missing metric is a scenario that changed without this script knowing.
      // Ignoring it would write a partial baseline, whose missing thresholds
      // would silently fall back to the inherited values.
      throw new Error(`Metric "${nom}" missing from the "${scenario}" summary.`);
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
  console.error('Usage: node scripts/enregistrer-baseline.mjs <scenario…>');
  process.exit(1);
}

const existant = JSON.parse(readFileSync(CIBLE, 'utf8'));
const baseline = {
  ...existant,
  mesureLe: new Date().toISOString().slice(0, 10),
  runner: process.env.RUNNER_DESCRIPTION ?? process.env.RUNNER_OS ?? 'unknown',
  commit: process.env.GITHUB_SHA ?? null,
  scenarios: { ...existant.scenarios },
};

for (const scenario of scenarios) {
  baseline.scenarios[scenario] = mesuresDe(scenario);
}

writeFileSync(CIBLE, `${JSON.stringify(baseline, null, 2)}\n`);

console.log(`Baseline written to ${CIBLE}:`);
for (const [scenario, mesures] of Object.entries(baseline.scenarios)) {
  for (const [metrique, statistiques] of Object.entries(mesures)) {
    const detail = Object.entries(statistiques)
      .map(([s, v]) => `${s} ${v} ms`)
      .join(' · ');
    console.log(`  ${scenario} — ${metrique}: ${detail}`);
  }
}
