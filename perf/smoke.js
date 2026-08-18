import { check, group, sleep } from 'k6';
import http from 'k6/http';

import { summaryHandler } from './lib/summary.js';

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
  thresholds: {
    // Calibrated on measurement, not on hope.
    //
    // Reference run, 2026-08-18, application and PostgreSQL on the same VPS,
    // production build, over three runs: median 5–7 ms, p(95) 13–36 ms,
    // p(99) 36–113 ms; the Catalogue group at p(95) 32 ms.
    //
    // The previous values — p(95) < 500, p(99) < 1000 — were inherited from the
    // in-memory store and left in place after the migration. They passed with
    // fourteen times the headroom, which means the endpoint could have got ten
    // times slower without anyone hearing about it. A threshold nothing can
    // cross is not a threshold.
    //
    // These sit at roughly five times the measured p(95). Wide enough that a
    // shared CI runner, which is slower and noisier than the reference machine,
    // does not go red on variance alone; narrow enough that the regressions this
    // test exists for — an N+1, a lost index, a synchronous hash on a hot path —
    // land the wrong side of it by an order of magnitude rather than a hair.
    http_req_duration: ['p(95)<250', 'p(99)<600'],
    http_req_failed: ['rate<0.01'],
    'group_duration{group:::Catalogue}': ['p(95)<300'],
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

export const handleSummary = summaryHandler('Test de charge — smoke (10 VU / 30 s)', 'smoke');
