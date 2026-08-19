import { check, group, sleep } from 'k6';
import http from 'k6/http';

import { summaryHandler } from './lib/summary.js';
import { CALIBRATION, expression, provenance } from './lib/seuils.js';

/**
 * Performance smoke test — runs on every pull request.
 *
 * The point is not to size the infrastructure; it is to catch the change that
 * turns a 40 ms endpoint into a 4 s one before it reaches main. Ten virtual
 * users for thirty seconds is enough to expose an accidental N+1 or a filter
 * that started scanning the whole catalog, and short enough that nobody is
 * tempted to skip it.
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '30s',
  // En calibration, on mesure : garder les seuils ferait échouer le run qui sert
  // précisément à les produire. Seul le taux d'échec reste tenu, sinon on
  // calibrerait sur une application qui répond des erreurs très vite.
  thresholds: CALIBRATION
    ? {
        http_req_failed: ['rate<0.01'],
        // Une borne absurde, mais nécessaire : k6 ne matérialise une
        // sous-métrique taguée que si un seuil la nomme. Sans cette ligne, le
        // résumé de calibration ne contient pas `group_duration{Catalogue}` et
        // il n'y a rien à enregistrer.
        'group_duration{group:::Catalogue}': ['p(95)<600000'],
      }
    : {
        // Dérivés de `perf/baseline.json`, mesuré sur le runner CI — voir
        // `lib/seuils.js`. Les valeurs `defaut` sont celles qui s'appliquaient
        // avant la calibration, mesurées le 2026-08-18 sur un VPS : médiane
        // 5–7 ms, p(95) 13–36 ms, p(99) 36–113 ms.
        //
        // Le facteur 5 est conservé — assez large pour qu'un runner partagé ne
        // rougisse pas sur sa propre variance, assez serré pour qu'un N+1 ou un
        // index perdu tombe du mauvais côté d'un ordre de grandeur, pas d'un
        // cheveu.
        http_req_duration: [
          expression('smoke', 'http_req_duration', 'p(95)', {
            facteur: 5,
            plancher: 100,
            defaut: 250,
          }),
          expression('smoke', 'http_req_duration', 'p(99)', {
            facteur: 5,
            plancher: 200,
            defaut: 600,
          }),
        ],
        http_req_failed: ['rate<0.01'],
        'group_duration{group:::Catalogue}': [
          expression('smoke', 'group_duration{group:::Catalogue}', 'p(95)', {
            facteur: 5,
            plancher: 150,
            defaut: 300,
          }),
        ],
      },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

const CATEGORIES = [
  'guitares-electriques',
  'basses-electriques',
  'pedales-effets',
  'amplis-guitare',
  'cordes',
];

export default function run() {
  group('Supervision', () => {
    const response = http.get(`${BASE_URL}/api/health`);
    check(response, {
      'health répond 200': (r) => r.status === 200,
      'health signale ok': (r) => r.json('status') === 'ok',
    });
  });

  group('Catalogue', () => {
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    const list = http.get(`${BASE_URL}/api/products?category=${category}&sort=prix-asc&limit=12`);
    check(list, {
      'liste répond 200': (r) => r.status === 200,
      'liste non vide': (r) => (r.json('items') || []).length > 0,
    });

    const items = list.json('items') || [];
    if (items.length > 0) {
      const slug = items[Math.floor(Math.random() * items.length)].slug;
      const detail = http.get(`${BASE_URL}/api/products/${slug}`);
      check(detail, { 'fiche produit répond 200': (r) => r.status === 200 });
    }
  });

  group('Recherche', () => {
    const response = http.get(`${BASE_URL}/api/products?q=stratocaster`);
    check(response, { 'recherche répond 200': (r) => r.status === 200 });
  });

  sleep(1);
}

export const handleSummary = summaryHandler(
  `Test de charge — smoke (10 VU / 30 s) — ${provenance('smoke')}`,
  'smoke',
);
