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
  // In calibration, we measure: keeping the thresholds would fail the very run
  // meant to produce them. Only the failure rate is still enforced, otherwise we
  // would calibrate on an application that answers errors very quickly.
  thresholds: CALIBRATION
    ? {
        http_req_failed: ['rate<0.01'],
        // An absurd bound, but a necessary one: k6 only materialises a tagged
        // sub-metric if a threshold names it. Without this line, the
        // calibration summary contains no `group_duration{Catalogue}` and there
        // is nothing to record.
        'group_duration{group:::Catalogue}': ['p(95)<600000'],
      }
    : {
        // Derived from `perf/baseline.json`, measured on the CI runner — see
        // `lib/seuils.js`. The `defaut` values are those that applied before
        // calibration, measured on 2026-08-18 on a VPS: median 5–7 ms, p(95)
        // 13–36 ms, p(99) 36–113 ms.
        //
        // The factor of 5 is kept — loose enough that a shared runner does not
        // turn red on its own variance, tight enough that an N+1 or a lost
        // index lands on the wrong side of an order of magnitude, not of a
        // hair.
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
      'health answers 200': (r) => r.status === 200,
      'health reports ok': (r) => r.json('status') === 'ok',
    });
  });

  group('Catalogue', () => {
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    const list = http.get(`${BASE_URL}/api/products?category=${category}&sort=prix-asc&limit=12`);
    check(list, {
      'list answers 200': (r) => r.status === 200,
      'list not empty': (r) => (r.json('items') || []).length > 0,
    });

    const items = list.json('items') || [];
    if (items.length > 0) {
      const slug = items[Math.floor(Math.random() * items.length)].slug;
      const detail = http.get(`${BASE_URL}/api/products/${slug}`);
      check(detail, { 'product page answers 200': (r) => r.status === 200 });
    }
  });

  group('Recherche', () => {
    const response = http.get(`${BASE_URL}/api/products?q=stratocaster`);
    check(response, { 'search answers 200': (r) => r.status === 200 });
  });

  sleep(1);
}

export const handleSummary = summaryHandler(
  `Load test — smoke (10 VUs / 30 s) — ${provenance('smoke')}`,
  'smoke',
);
