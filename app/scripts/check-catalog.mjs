/**
 * Contrôle de cohérence du catalogue généré.
 *
 * Vérifie les invariants que `generate-catalog.mjs` est censé garantir — unicité
 * des slugs et des SKU — puis, surtout, que chaque facette dont dépendent les
 * specs de filtrage reste **non vide et non totale**.
 *
 * Cette seconde garde est celle qui justifie le script. Une facette tombée à
 * zéro ne rend pas la suite rouge : elle la rend vide. `TC-215` affirme que les
 * filtres booléens se cumulent, en itérant sur les résultats —
 *
 *     for (const product of body.items) { expect(product.stock).toBeGreaterThan(0) }
 *
 * — ce qui est vrai de toute liste vide. Le test passe, la couverture a disparu,
 * et rien ne le signale. La facette totale a le défaut symétrique : filtrer sur
 * une propriété que tous les produits portent ne distingue rien, et l'assertion
 * réussit sans que le filtre ait rien fait.
 *
 * Sort en code 1 si un invariant est violé.
 *
 * Usage : node app/scripts/check-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'src', 'data', 'products.json');

const products = JSON.parse(readFileSync(CATALOG, 'utf8'));
const total = products.length;

/** Renvoie les valeurs apparaissant plus d'une fois pour la clé donnée. */
function duplicates(key) {
  const seen = new Map();
  for (const product of products) {
    seen.set(product[key], (seen.get(product[key]) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([value]) => value);
}

const facets = {
  rupture: (p) => p.stock === 0,
  promos: (p) => p.discountPct > 0,
  gauchers: (p) => p.leftHanded,
  nouveautes: (p) => p.isNew,
  bestsellers: (p) => p.bestSeller,
};

const problemes = [];

console.log(`produits : ${total}`);

for (const [label, predicate] of Object.entries(facets)) {
  const dedans = products.filter(predicate).length;
  console.log(`${label} : ${dedans}`);

  if (dedans === 0) {
    problemes.push(`facette « ${label} » vide : les specs qui la filtrent passeront à vide`);
  } else if (dedans === total) {
    problemes.push(
      `facette « ${label} » universelle (${dedans}/${total}) : la filtrer ne distingue plus rien`,
    );
  }
}

for (const key of ['slug', 'sku']) {
  const dupes = duplicates(key);
  if (dupes.length > 0) {
    problemes.push(`${key} dupliqués : ${dupes.join(', ')}`);
  }
}

if (problemes.length > 0) {
  console.error('');
  for (const probleme of problemes) console.error(`✗ ${probleme}`);
  process.exit(1);
}

console.log('\nslugs et SKU uniques, toutes les facettes discriminent');
