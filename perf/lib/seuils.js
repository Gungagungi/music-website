/**
 * Thresholds derived from a measurement taken on the CI runner.
 *
 * This repository's thresholds used to be calibrated on a VPS — the machine of
 * whoever wrote them. A shared GitHub runner is slower and above all more
 * variable, so a threshold tuned on another machine no longer means anything:
 * too loose, it detects nothing; too tight, it turns red on the neighbours'
 * noise.
 *
 * `baseline.json` is therefore produced by the "Mesurer la baseline de
 * performance" workflow, which runs the same scripts on the runner and writes
 * the measurements there. It is the same principle as the visual baselines: the
 * reference belongs to the environment that compares against it.
 *
 * As long as no measurement exists, `defaut` applies — the historical values, so
 * the suite stays usable without having to run the calibration first.
 */
const baseline = JSON.parse(open('../baseline.json'));

/** Calibration mode: measure without thresholds, otherwise the run being calibrated fails on the thresholds it is meant to produce. */
export const CALIBRATION = __ENV.K6_CALIBRATION === '1';

export function mesure(scenario, metrique, statistique) {
  const valeur = baseline.scenarios?.[scenario]?.[metrique]?.[statistique];
  return typeof valeur === 'number' ? valeur : null;
}

/**
 * Threshold = `facteur` × the measurement, never less than `plancher`.
 *
 * The floor is not a stylistic precaution: measurements are counted in tens of
 * milliseconds, and five times 12 ms makes a 60 ms threshold that a garbage
 * collector pause is enough to cross. It sets the noise we accept not to see,
 * below which multiplying no longer makes sense.
 */
export function seuil(scenario, metrique, statistique, { facteur, plancher, defaut }) {
  const valeur = mesure(scenario, metrique, statistique);
  if (valeur === null) return defaut;
  return Math.max(Math.round(facteur * valeur), plancher);
}

/** `p(95)<250` — the expression k6 expects, built from the measurement. */
export function expression(scenario, metrique, statistique, bornes) {
  return `${statistique}<${seuil(scenario, metrique, statistique, bornes)}`;
}

/** What the summary must say about where the thresholds come from, measured or inherited. */
export function provenance(scenario) {
  const mesures = baseline.scenarios?.[scenario];
  if (!mesures) return 'inherited thresholds — no reference measurement on the CI runner';
  return `thresholds derived from the measurement of ${baseline.mesureLe} on ${baseline.runner}`;
}
