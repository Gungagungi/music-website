import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { buildMarkdown, metric } from './lib/summary.js';

/**
 * Breaking-point test — manual, never in CI.
 *
 * The smoke and load tests answer "has it regressed". This one answers "how far
 * does it hold", which is a different question and calls for a different
 * executor: `ramping-arrival-rate` imposes an arrival rate and sticks to it, even
 * if that means piling up VUs. With `ramping-vus`, a saturated server simply
 * makes its fifty users wait, the rate caps itself and the wall stays invisible
 * — you measure the script's patience, not the machine's capacity.
 *
 * The run ends **red when it succeeds**: finding the breaking point means
 * crossing the thresholds. That is why it is wired into no workflow that guards
 * a merge.
 *
 * Expected target: 2 vCPUs, a single Node process, a PostgreSQL pool of 10
 * connections (`DATABASE_POOL_MAX`). The two ceilings do not show the same way —
 * CPU saturation stretches latencies continuously, pool exhaustion cuts off
 * sharply at `connectionTimeoutMillis` (5 s) with 500 errors. The "failures"
 * column of the per-stage table is what tells them apart.
 *
 *   k6 run perf/rupture.js
 *   BASE_URL=https://example.com PART_ECRITURE=0 k6 run perf/rupture.js
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Share of journeys that write (add to cart).
 *
 * The write path is the one that takes a pool connection to recompute a total;
 * excluding it would measure the reassuring half of the application. But a
 * breaking-point test creates far more carts than a load test, and against a
 * real production one wants to be able to observe reads only: `PART_ECRITURE=0`.
 */
const PART_ECRITURE = Number(__ENV.PART_ECRITURE ?? 0.2);

/** Stages in journeys per second. One journey = 3 reads, plus one write depending on `PART_ECRITURE`. */
const PALIERS = (__ENV.PALIERS || '10,25,50,100,200,400')
  .split(',')
  .map((valeur) => Number(valeur.trim()))
  .filter((valeur) => Number.isFinite(valeur) && valeur > 0);

const MONTEE = Number(__ENV.MONTEE_SECONDES ?? 5);
const PLATEAU = Number(__ENV.PLATEAU_SECONDES ?? 30);
const DUREE_PALIER = MONTEE + PLATEAU;

const paliersDuration = new Trend('palier_atteint', false);
const journeyFailures = new Rate('journey_failed');

/**
 * k6 only materialises a tagged sub-metric if a threshold names it — same reason
 * as for calibration in `smoke.js`. Without these absurd bounds, the summary
 * would contain no `http_req_duration{palier:100}` and there would be nothing to
 * break down per stage, that is, nothing to read.
 */
function sondesParPalier() {
  const sondes = {};
  for (const palier of PALIERS) {
    sondes[`http_req_duration{palier:${palier}}`] = ['p(95)<600000'];
    sondes[`http_req_failed{palier:${palier}}`] = ['rate<=1'];
  }
  return sondes;
}

export const options = {
  scenarios: {
    rupture: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      // One pre-allocated VU per journey/s of the first stage is not enough as
      // soon as latency rises: `maxVUs` is what absorbs the drift. Too low, and
      // k6 reports that it cannot sustain the rate, and its own limit gets
      // mistaken for the server's.
      preAllocatedVUs: 50,
      maxVUs: Number(__ENV.MAX_VUS ?? 600),
      stages: PALIERS.flatMap((palier) => [
        { duration: `${MONTEE}s`, target: palier },
        { duration: `${PLATEAU}s`, target: palier },
      ]),
      gracefulStop: '10s',
    },
  },
  thresholds: {
    ...sondesParPalier(),
    // The operational definition of "broken", and the only place it is written
    // down. `abortOnFail` stops the ramp instead of hammering a stack already on
    // its knees: past the breaking point, the next stages measure nothing we do
    // not already know.
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: [
      { threshold: 'p(95)<1000', abortOnFail: true, delayAbortEval: '20s' },
    ],
  },
  // `count` on top of the usual statistics: it is what distinguishes a stage
  // actually run through from one the abort never reached. A tagged sub-metric
  // exists as soon as a threshold names it, measured or not.
  summaryTrendStats: ['count', 'med', 'p(95)', 'p(99)', 'max'],
};

const CATEGORIES = ['guitares-electriques', 'basses-electriques', 'pedales-effets', 'cordes'];

export function setup() {
  const sonde = http.get(`${BASE_URL}/api/health`);
  if (sonde.status !== 200) {
    throw new Error(`${BASE_URL}/api/health answers ${sonde.status} — target unreachable, nothing to measure.`);
  }
  return { debut: Date.now() };
}

/**
 * Current stage, derived from elapsed time.
 *
 * k6 does not expose the current stage to the iteration. The ramp-up phase is
 * tagged `rampe` rather than with the targeted stage: mixing its requests in
 * would make each stage carry the latency of the previous step, and smooth out
 * precisely the discontinuity being looked for.
 */
function palierCourant(debut) {
  const ecoule = (Date.now() - debut) / 1000;
  const index = Math.floor(ecoule / DUREE_PALIER);
  if (index >= PALIERS.length) return String(PALIERS[PALIERS.length - 1]);
  if (ecoule % DUREE_PALIER < MONTEE) return 'rampe';
  return String(PALIERS[index]);
}

export default function run(data) {
  const palier = palierCourant(data.debut);
  const params = { tags: { palier } };
  let failed = false;

  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const liste = http.get(
    `${BASE_URL}/api/products?category=${category}&inStock=true&sort=note&limit=12`,
    params,
  );
  failed = failed || !check(liste, { 'category answers 200': (r) => r.status === 200 });

  const items = liste.status === 200 ? liste.json('items') || [] : [];
  let sku = null;

  if (items.length > 0) {
    const slug = items[Math.floor(Math.random() * items.length)].slug;
    const fiche = http.get(`${BASE_URL}/api/products/${slug}`, params);
    failed = failed || !check(fiche, { 'product page answers 200': (r) => r.status === 200 });
    if (fiche.status === 200) sku = fiche.json('sku');
  }

  const recherche = http.get(`${BASE_URL}/api/products?q=stratocaster`, params);
  failed = failed || !check(recherche, { 'search answers 200': (r) => r.status === 200 });

  if (sku && Math.random() < PART_ECRITURE) {
    const ajout = http.post(`${BASE_URL}/api/cart/items`, JSON.stringify({ sku, quantity: 1 }), {
      headers: { 'content-type': 'application/json' },
      tags: { palier },
      // Same reason as in `load.js`: an empty shelf is a business outcome, not
      // an HTTP error. Counting it as one would trigger `abortOnFail` on
      // depleted stock and pass off a stock-out as a service outage.
      responseCallback: http.expectedStatuses(201, 409),
    });
    failed =
      failed ||
      !check(ajout, { 'add accepted or out of stock': (r) => [201, 409].includes(r.status) });
  }

  journeyFailures.add(failed, { palier });
  if (palier !== 'rampe') paliersDuration.add(Number(palier));
}

/** Per-stage breakdown — the only output that answers "how far does it hold". */
function tableauParPalier(data) {
  const lignes = [];
  for (const palier of paliersMesures(data)) {
    const duree = data.metrics[`http_req_duration{palier:${palier}}`];
    const echecs = data.metrics[`http_req_failed{palier:${palier}}`];
    const taux = echecs?.values.rate ?? null;
    const requetes = duree.values.count ?? 0;
    // The breaking stage is the first one that leaves the envelope: the same
    // definition as the `abortOnFail` thresholds, not a judgement by eye.
    const rompu = (taux !== null && taux >= 0.05) || duree.values['p(95)'] >= 1000;
    lignes.push(
      `| ${palier} journeys/s | ${requetes} | ${duree.values.med.toFixed(0)} ms | ${duree.values['p(95)'].toFixed(0)} ms | ` +
        `${duree.values['p(99)'].toFixed(0)} ms | ${taux === null ? 'n/a' : `${(taux * 100).toFixed(2)} %`} | ` +
        `${rompu ? '❌ broken' : '✅ held'} |`,
    );
  }
  return lignes;
}

/**
 * Stages actually measured.
 *
 * A failing `setup()` still produces a summary, and without this count the table
 * showed six stages at 0 ms "✅ held" and concluded 400 journeys/s when not a
 * single request had gone out. A capacity report that lies when the target is
 * unreachable is worse than no report at all.
 */
function paliersMesures(data) {
  return PALIERS.filter((palier) => {
    const duree = data.metrics[`http_req_duration{palier:${palier}}`];
    return duree && (duree.values.count ?? 0) > 0;
  });
}

function palierMaximalTenu(data) {
  let dernier = null;
  for (const palier of paliersMesures(data)) {
    const duree = data.metrics[`http_req_duration{palier:${palier}}`];
    if (!duree) continue;
    const taux = data.metrics[`http_req_failed{palier:${palier}}`]?.values.rate ?? 0;
    if (taux >= 0.05 || duree.values['p(95)'] >= 1000) break;
    dernier = palier;
  }
  return dernier;
}

export function handleSummary(data) {
  const mesures = paliersMesures(data);
  const tenu = palierMaximalTenu(data);
  const requetesParParcours = 3 + PART_ECRITURE;

  let verdict;
  if (mesures.length === 0) {
    verdict =
      '**Inconclusive run** — no stage produced a measurement. Target unreachable, ' +
      'or `setup()` interrupted: there is no capacity to infer.';
  } else if (tenu === null) {
    verdict = '**No stage held** — the target was already out of the envelope at the first stage.';
  } else {
    verdict =
      `**Last stage held: ${tenu} journeys/s** (~${Math.round(tenu * requetesParParcours)} req/s), ` +
      `p(95) < 1000 ms and under 5 % failures.`;
  }

  const markdown = [
    buildMarkdown(`Breaking-point test — ${PALIERS.join(' → ')} journeys/s`, data),
    '',
    '### Breaking point',
    '',
    verdict,
    '',
    `Write share: ${(PART_ECRITURE * 100).toFixed(0)} % of journeys · target: ${BASE_URL}`,
    '',
    '| Stage | requests | median | p(95) | p(99) | failures | verdict |',
    '| --- | ---: | ---: | ---: | ---: | ---: | :---: |',
    ...tableauParPalier(data),
    '',
    '> This scenario\'s thresholds are breaking-point detectors, not objectives:',
    '> a run that crosses them has succeeded. It guards no merge and is not compared',
    `> to \`perf/baseline.json\`. Overall measured rate: ${(data.metrics.http_reqs?.values.rate ?? 0).toFixed(1)} req/s,`,
    `> overall p(95) ${(metric(data, 'http_req_duration') ?? 0).toFixed(0)} ms.`,
    '',
  ].join('\n');

  return {
    stdout: `\n${markdown}\n`,
    'perf/results/rupture.json': JSON.stringify(data, null, 2),
    'perf/results/rupture.md': markdown,
  };
}
