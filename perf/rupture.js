import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { buildMarkdown, metric } from './lib/summary.js';

/**
 * Test de rupture — manuel, jamais en CI.
 *
 * Le smoke et le test de charge répondent à « est-ce que ça a régressé ». Celui-ci
 * répond à « jusqu'où ça tient », ce qui est une autre question et demande un autre
 * exécuteur : `ramping-arrival-rate` impose un débit d'arrivée et l'assume, quitte
 * à empiler les VU. Avec `ramping-vus`, un serveur saturé fait simplement attendre
 * ses cinquante utilisateurs, le débit plafonne tout seul et le mur reste invisible
 * — on mesure la patience du script, pas la capacité de la machine.
 *
 * Le run se termine **rouge quand il réussit** : trouver la rupture, c'est franchir
 * les seuils. C'est pourquoi il n'est branché sur aucun workflow qui garde un merge.
 *
 * Cible attendue : 2 vCPU, un seul process Node, pool PostgreSQL à 10 connexions
 * (`DATABASE_POOL_MAX`). Les deux plafonds ne se manifestent pas pareil — la
 * saturation CPU étire les latences de façon continue, l'épuisement du pool coupe
 * net à `connectionTimeoutMillis` (5 s) en erreurs 500. La colonne « échecs » du
 * tableau par palier est ce qui les distingue.
 *
 *   k6 run perf/rupture.js
 *   BASE_URL=https://exemple.fr PART_ECRITURE=0 k6 run perf/rupture.js
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Part des parcours qui écrivent (ajout au panier).
 *
 * Le chemin d'écriture est celui qui prend une connexion du pool pour recalculer
 * un total ; l'exclure mesurerait la moitié rassurante de l'application. Mais un
 * test de rupture crée bien plus de paniers qu'un test de charge, et contre une
 * production réelle on veut pouvoir n'observer que la lecture : `PART_ECRITURE=0`.
 */
const PART_ECRITURE = Number(__ENV.PART_ECRITURE ?? 0.2);

/** Paliers en parcours par seconde. Un parcours = 3 lectures, plus une écriture selon `PART_ECRITURE`. */
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
 * k6 ne matérialise une sous-métrique taguée que si un seuil la nomme — même
 * raison qu'en calibration dans `smoke.js`. Sans ces bornes absurdes, le résumé
 * ne contiendrait aucun `http_req_duration{palier:100}` et il n'y aurait rien à
 * ventiler par palier, c'est-à-dire rien à lire.
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
      // Un VU préalloué par parcours/s du premier palier ne suffit pas dès que la
      // latence monte : c'est `maxVUs` qui absorbe la dérive. Trop bas, k6 signale
      // qu'il n'arrive pas à tenir le débit et on prend sa propre limite pour celle
      // du serveur.
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
    // La définition opérationnelle de « rompu », et le seul endroit où elle est
    // écrite. `abortOnFail` arrête la rampe au lieu de continuer à marteler une
    // pile déjà à genoux : au-delà du point de rupture, les paliers suivants ne
    // mesurent plus rien qu'on ne sache déjà.
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: [
      { threshold: 'p(95)<1000', abortOnFail: true, delayAbortEval: '20s' },
    ],
  },
  // `count` en plus des statistiques habituelles : c'est lui qui distingue un
  // palier réellement traversé d'un palier que l'abort n'a jamais atteint. Une
  // sous-métrique taguée existe dès qu'un seuil la nomme, mesurée ou non.
  summaryTrendStats: ['count', 'med', 'p(95)', 'p(99)', 'max'],
};

const CATEGORIES = ['guitares-electriques', 'basses-electriques', 'pedales-effets', 'cordes'];

export function setup() {
  const sonde = http.get(`${BASE_URL}/api/health`);
  if (sonde.status !== 200) {
    throw new Error(`${BASE_URL}/api/health répond ${sonde.status} — cible injoignable, rien à mesurer.`);
  }
  return { debut: Date.now() };
}

/**
 * Palier en cours, déduit du temps écoulé.
 *
 * k6 n'expose pas le stage courant à l'itération. La phase de montée est taguée
 * `rampe` et non avec le palier visé : y mélanger les requêtes ferait porter à
 * chaque palier la latence de la marche précédente, et lisserait précisément la
 * discontinuité qu'on cherche.
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
  failed = failed || !check(liste, { 'rayon répond 200': (r) => r.status === 200 });

  const items = liste.status === 200 ? liste.json('items') || [] : [];
  let sku = null;

  if (items.length > 0) {
    const slug = items[Math.floor(Math.random() * items.length)].slug;
    const fiche = http.get(`${BASE_URL}/api/products/${slug}`, params);
    failed = failed || !check(fiche, { 'fiche répond 200': (r) => r.status === 200 });
    if (fiche.status === 200) sku = fiche.json('sku');
  }

  const recherche = http.get(`${BASE_URL}/api/products?q=stratocaster`, params);
  failed = failed || !check(recherche, { 'recherche répond 200': (r) => r.status === 200 });

  if (sku && Math.random() < PART_ECRITURE) {
    const ajout = http.post(`${BASE_URL}/api/cart/items`, JSON.stringify({ sku, quantity: 1 }), {
      headers: { 'content-type': 'application/json' },
      tags: { palier },
      // Même raison que dans `load.js` : un rayon vide est un résultat métier,
      // pas une erreur HTTP. Le compter comme telle déclencherait `abortOnFail`
      // sur un stock épuisé et ferait passer une rupture de stock pour une
      // rupture de service.
      responseCallback: http.expectedStatuses(201, 409),
    });
    failed =
      failed ||
      !check(ajout, { 'ajout accepté ou stock épuisé': (r) => [201, 409].includes(r.status) });
  }

  journeyFailures.add(failed, { palier });
  if (palier !== 'rampe') paliersDuration.add(Number(palier));
}

/** Ventilation par palier — la seule sortie qui répond à « jusqu'où ça tient ». */
function tableauParPalier(data) {
  const lignes = [];
  for (const palier of paliersMesures(data)) {
    const duree = data.metrics[`http_req_duration{palier:${palier}}`];
    const echecs = data.metrics[`http_req_failed{palier:${palier}}`];
    const taux = echecs?.values.rate ?? null;
    const requetes = duree.values.count ?? 0;
    // Le palier de rupture est le premier qui sort de l'enveloppe : c'est la
    // même définition que celle des seuils `abortOnFail`, pas un jugement à l'œil.
    const rompu = (taux !== null && taux >= 0.05) || duree.values['p(95)'] >= 1000;
    lignes.push(
      `| ${palier} parcours/s | ${requetes} | ${duree.values.med.toFixed(0)} ms | ${duree.values['p(95)'].toFixed(0)} ms | ` +
        `${duree.values['p(99)'].toFixed(0)} ms | ${taux === null ? 'n/a' : `${(taux * 100).toFixed(2)} %`} | ` +
        `${rompu ? '❌ rompu' : '✅ tenu'} |`,
    );
  }
  return lignes;
}

/**
 * Nombre de paliers effectivement mesurés.
 *
 * Un `setup()` qui échoue produit quand même un résumé, et sans ce compte le
 * tableau affichait six paliers à 0 ms « ✅ tenu » puis concluait à 400
 * parcours/s alors qu'aucune requête n'était partie. Un rapport de capacité qui
 * ment quand la cible est injoignable est pire que pas de rapport du tout.
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
      '**Run non concluant** — aucun palier n’a produit de mesure. Cible injoignable, ' +
      'ou `setup()` interrompu : il n’y a pas de capacité à en déduire.';
  } else if (tenu === null) {
    verdict = '**Aucun palier tenu** — la cible sortait déjà de l’enveloppe au premier palier.';
  } else {
    verdict =
      `**Dernier palier tenu : ${tenu} parcours/s** (~${Math.round(tenu * requetesParParcours)} req/s), ` +
      `p(95) < 1000 ms et moins de 5 % d’échecs.`;
  }

  const markdown = [
    buildMarkdown(`Test de rupture — ${PALIERS.join(' → ')} parcours/s`, data),
    '',
    '### Point de rupture',
    '',
    verdict,
    '',
    `Part d’écriture : ${(PART_ECRITURE * 100).toFixed(0)} % des parcours · cible : ${BASE_URL}`,
    '',
    '| Palier | requêtes | médiane | p(95) | p(99) | échecs | verdict |',
    '| --- | ---: | ---: | ---: | ---: | ---: | :---: |',
    ...tableauParPalier(data),
    '',
    '> Les seuils de ce scénario sont des détecteurs de rupture, pas des objectifs :',
    '> un run qui les franchit a réussi. Il ne garde aucun merge et ne se compare pas',
    `> à \`perf/baseline.json\`. Débit global mesuré : ${(data.metrics.http_reqs?.values.rate ?? 0).toFixed(1)} req/s,`,
    `> p(95) global ${(metric(data, 'http_req_duration') ?? 0).toFixed(0)} ms.`,
    '',
  ].join('\n');

  return {
    stdout: `\n${markdown}\n`,
    'perf/results/rupture.json': JSON.stringify(data, null, 2),
    'perf/results/rupture.md': markdown,
  };
}
