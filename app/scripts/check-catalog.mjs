/**
 * Consistency check of the generated catalogue.
 *
 * Checks the invariants `generate-catalog.mjs` is supposed to guarantee —
 * uniqueness of slugs and SKUs — then, above all, that every facet the filtering
 * specs depend on stays **neither empty nor total**.
 *
 * That second guard is what justifies the script. A facet that drops to zero
 * does not turn the suite red: it turns it empty. `TC-215` asserts that boolean
 * filters combine, by iterating over the results —
 *
 *     for (const product of body.items) { expect(product.stock).toBeGreaterThan(0) }
 *
 * — which holds true for any empty list. The test passes, the coverage is gone,
 * and nothing flags it. A total facet has the symmetrical flaw: filtering on a
 * property every product carries distinguishes nothing, and the assertion
 * succeeds without the filter having done anything.
 *
 * Exits with code 1 if an invariant is violated.
 *
 * Usage: node app/scripts/check-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'src', 'data', 'products.json');

const products = JSON.parse(readFileSync(CATALOG, 'utf8'));
const total = products.length;

/** Returns the values that appear more than once for the given key. */
function duplicates(key) {
  const seen = new Map();
  for (const product of products) {
    seen.set(product[key], (seen.get(product[key]) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([value]) => value);
}

const facets = {
  'out of stock': (p) => p.stock === 0,
  'on sale': (p) => p.discountPct > 0,
  'left-handed': (p) => p.leftHanded,
  'new arrivals': (p) => p.isNew,
  bestsellers: (p) => p.bestSeller,
};

const problemes = [];

console.log(`products: ${total}`);

for (const [label, predicate] of Object.entries(facets)) {
  const dedans = products.filter(predicate).length;
  console.log(`${label}: ${dedans}`);

  if (dedans === 0) {
    problemes.push(`facet "${label}" is empty: the specs that filter on it will pass on nothing`);
  } else if (dedans === total) {
    problemes.push(
      `facet "${label}" is universal (${dedans}/${total}): filtering on it no longer distinguishes anything`,
    );
  }
}

for (const key of ['slug', 'sku']) {
  const dupes = duplicates(key);
  if (dupes.length > 0) {
    problemes.push(`duplicate ${key} values: ${dupes.join(', ')}`);
  }
}

if (problemes.length > 0) {
  console.error('');
  for (const probleme of problemes) console.error(`✗ ${probleme}`);
  process.exit(1);
}

console.log('\nslugs and SKUs are unique, every facet discriminates');
