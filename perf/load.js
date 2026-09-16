import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { summaryHandler } from './lib/summary.js';
import { CALIBRATION, expression, provenance } from './lib/seuils.js';

/**
 * Load test — nightly.
 *
 * Models a browsing session ending in a cart, because that is where the
 * expensive work lives: filtering, then a write path that recomputes totals.
 * Measuring `/api/products` alone would produce reassuring numbers about the
 * cheapest thing the application does.
 *
 * Checkout is deliberately excluded: it decrements real stock, and a load test
 * that empties the catalog leaves the environment unusable for the suite that
 * runs after it.
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const cartDuration = new Trend('cart_add_duration', true);
const journeyFailures = new Rate('journey_failed');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: CALIBRATION
    ? { http_req_failed: ['rate<0.02'], journey_failed: ['rate<0.02'] }
    : {
        // Derived from `perf/baseline.json`, measured on the CI runner. The
        // `defaut` values come from the reference run of 2026-08-18 on a VPS, at
        // 50 VUs: median 5 ms, p(95) 17 ms, p(99) 28 ms, add to cart at p(95)
        // 26 ms.
        //
        // This stage is faster than the smoke test, which is no paradox: at
        // fifty users the pool is warm and the plans are cached, whereas the
        // smoke test pays for both in its first seconds. It is also why the
        // thresholds here are not the smoke test's scaled up — the machine is
        // not the bottleneck at this level of load, and what they watch is
        // still the same class of regression, not saturation.
        http_req_duration: [
          expression('load', 'http_req_duration', 'p(95)', {
            facteur: 5,
            plancher: 100,
            defaut: 400,
          }),
          expression('load', 'http_req_duration', 'p(99)', {
            facteur: 5,
            plancher: 200,
            defaut: 800,
          }),
        ],
        http_req_failed: ['rate<0.02'],
        cart_add_duration: [
          expression('load', 'cart_add_duration', 'p(95)', {
            facteur: 5,
            plancher: 150,
            defaut: 300,
          }),
        ],
        journey_failed: ['rate<0.02'],
      },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

const CATEGORIES = ['guitares-electriques', 'basses-electriques', 'pedales-effets', 'cordes'];

export default function run() {
  let failed = false;

  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  group('Parcourir un rayon', () => {
    const response = http.get(
      `${BASE_URL}/api/products?category=${category}&inStock=true&sort=note&limit=12`,
    );
    failed = failed || !check(response, { 'category answers 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2);

  let slug = null;
  group('Affiner par prix', () => {
    const response = http.get(
      `${BASE_URL}/api/products?category=${category}&minPrice=5000&maxPrice=200000&sort=prix-asc&limit=12`,
    );
    failed = failed || !check(response, { 'filter answers 200': (r) => r.status === 200 });

    const items = response.json('items') || [];
    if (items.length > 0) slug = items[Math.floor(Math.random() * items.length)].slug;
  });

  sleep(Math.random() * 2);

  let sku = null;
  if (slug) {
    group('Consulter une fiche', () => {
      const response = http.get(`${BASE_URL}/api/products/${slug}`);
      failed = failed || !check(response, { 'product page answers 200': (r) => r.status === 200 });
      if (response.status === 200) sku = response.json('sku');
    });
  }

  sleep(Math.random() * 3);

  if (sku) {
    group('Ajouter au panier', () => {
      const response = http.post(
        `${BASE_URL}/api/cart/items`,
        JSON.stringify({ sku, quantity: 1 }),
        {
          headers: { 'content-type': 'application/json' },
          // Without this, k6 counts every 409 as an HTTP failure and the run
          // goes red for behaving exactly as designed. A depleted shelf is a
          // business outcome, not an error rate.
          responseCallback: http.expectedStatuses(201, 409),
        },
      );

      cartDuration.add(response.timings.duration);
      // 409 is a legitimate outcome under load — the shelf can genuinely empty.
      failed =
        failed ||
        !check(response, { 'add to cart accepted or out of stock': (r) => [201, 409].includes(r.status) });

      if (response.status === 201) {
        const cartId = response.json('id');
        const cart = http.get(`${BASE_URL}/api/cart`, { headers: { 'x-cart-id': cartId } });
        failed = failed || !check(cart, { 'cart read back 200': (r) => r.status === 200 });
      }
    });
  }

  journeyFailures.add(failed);
  sleep(1);
}

export const handleSummary = summaryHandler(`Load test — ramp-up to 50 VUs — ${provenance('load')}`, 'load');
