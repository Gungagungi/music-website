/**
 * Deterministic catalog generator.
 *
 * The demo store needs a catalog that is realistic enough to exercise faceting,
 * sorting and pagination, yet byte-for-byte identical on every machine — visual
 * regression baselines and API contract tests both depend on that.
 *
 * Every "random looking" attribute (rating, stock, review count, release date)
 * is derived from a hash of the SKU through a seeded PRNG, so regenerating the
 * catalog never produces a diff unless the source table below changes.
 *
 * Usage: node scripts/generate-catalog.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'src', 'data', 'products.json');

/** xmur3 string hash → 32-bit seed. */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG — small, fast, deterministic. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const skuPart = (value, length) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, length)
    .padEnd(length, 'X');

/**
 * Source table: [brand, model, category, price (EUR, VAT included), colors, specs]
 * Prices are stored in cents downstream — see src/lib/money.ts for the rationale.
 */
const CATALOG = [
  // ---------------------------------------------------------------- electric guitars
  ['Fender', 'Player II Stratocaster MN', 'guitares-electriques', 849, ['Sunburst', 'Noir', 'Blanc Vintage'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Érable', Micros: '3x Single Coil', Frettes: '22' }],
  ['Fender', 'American Pro III Telecaster', 'guitares-electriques', 1899, ['Butterscotch', 'Noir'], { Corps: 'Frêne', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Single Coil', Frettes: '22' }],
  ['Gibson', 'Les Paul Standard 60s', 'guitares-electriques', 2799, ['Bourbon Burst', 'Ebony'], { Corps: 'Acajou', Table: 'Érable flammé', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '22' }],
  ['Gibson', 'SG Standard', 'guitares-electriques', 1899, ['Heritage Cherry', 'Ebony'], { Corps: 'Acajou', Manche: 'Acajou', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '22' }],
  ['Epiphone', 'Les Paul Classic', 'guitares-electriques', 699, ['Honey Burst', 'Ebony'], { Corps: 'Acajou', Table: 'Érable', Touche: 'Laurier', Micros: '2x Humbucker', Frettes: '22' }],
  ['Squier', 'Classic Vibe 60s Stratocaster', 'guitares-electriques', 429, ['Lake Placid Blue', 'Sunburst'], { Corps: 'Peuplier', Manche: 'Érable', Touche: 'Laurier', Micros: '3x Single Coil', Frettes: '21' }],
  ['Ibanez', 'RG550 Genesis', 'guitares-electriques', 1099, ['Desert Sun Yellow', 'Purple Neon'], { Corps: 'Tilleul', Manche: 'Érable/Noyer', Touche: 'Érable', Micros: 'HSH', Frettes: '24' }],
  ['Ibanez', 'AZ2402 Prestige', 'guitares-electriques', 2299, ['Ice Blue', 'Black Flat'], { Corps: 'Aulne', Manche: 'Érable rôti', Touche: 'Érable', Micros: '2x Humbucker', Frettes: '24' }],
  ['PRS', 'SE Custom 24', 'guitares-electriques', 949, ['Faded Blue', 'Charcoal Burst'], { Corps: 'Acajou', Table: 'Érable', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '24' }],
  ['Harley Benton', 'ST-62 Vintage Series', 'guitares-electriques', 165, ['Sunburst', 'Noir', 'Rouge'], { Corps: 'Tilleul', Manche: 'Érable', Touche: 'Laurier', Micros: '3x Single Coil', Frettes: '21' }],
  ['ESP', 'LTD EC-256', 'guitares-electriques', 549, ['Black Satin', 'Snow White'], { Corps: 'Acajou', Manche: 'Acajou', Touche: 'Jatoba', Micros: '2x Humbucker', Frettes: '22' }],
  ['Jackson', 'Pro Series Soloist SL2', 'guitares-electriques', 1249, ['Riviera Blue', 'Black'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Ébène', Micros: '2x Humbucker', Frettes: '24' }],
  ['Gretsch', 'G2622 Streamliner', 'guitares-electriques', 549, ['Walnut Stain', 'Torino Green'], { Corps: 'Érable laminé', Manche: 'Nato', Touche: 'Laurier', Micros: '2x Broad’Tron', Frettes: '22' }],

  // ---------------------------------------------------------------- acoustic guitars
  ['Martin Guitar', 'D-28 Standard', 'guitares-acoustiques', 3399, ['Natural'], { Format: 'Dreadnought', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Palissandre', Touche: 'Ébène', Électronique: 'Non' }],
  ['Taylor', '214ce Plus', 'guitares-acoustiques', 1449, ['Natural'], { Format: 'Grand Auditorium', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Koa laminé', Touche: 'Ébène', Électronique: 'Expression System 2' }],
  ['Yamaha', 'FG800M', 'guitares-acoustiques', 229, ['Natural Matte'], { Format: 'Dreadnought', Table: 'Épicéa massif', 'Dos & éclisses': 'Nato', Touche: 'Palissandre', Électronique: 'Non' }],
  ['Harley Benton', 'D-120CE', 'guitares-acoustiques', 139, ['Natural', 'Black'], { Format: 'Dreadnought Cutaway', Table: 'Épicéa', 'Dos & éclisses': 'Acajou', Touche: 'Amarante', Électronique: 'Oui' }],
  ['Gibson', 'J-45 Studio Walnut', 'guitares-acoustiques', 2199, ['Walnut Burst'], { Format: 'Round Shoulder', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Noyer', Touche: 'Palissandre', Électronique: 'LR Baggs VTC' }],
  ['Cort', 'Earth 70 OP', 'guitares-acoustiques', 259, ['Open Pore Natural'], { Format: 'Dreadnought', Table: 'Épicéa massif', 'Dos & éclisses': 'Acajou', Touche: 'Merbau', Électronique: 'Non' }],
  ['Fender', 'CD-60SCE All Mahogany', 'guitares-acoustiques', 289, ['Natural Mahogany'], { Format: 'Dreadnought Cutaway', Table: 'Acajou', 'Dos & éclisses': 'Acajou', Touche: 'Laurier', Électronique: 'Fishman' }],
  ['Takamine', 'GD30CE-NAT', 'guitares-acoustiques', 429, ['Natural'], { Format: 'Dreadnought Cutaway', Table: 'Épicéa massif', 'Dos & éclisses': 'Acajou', Touche: 'Laurier', Électronique: 'TP-4TD' }],

  // ---------------------------------------------------------------- classical guitars
  ['Yamaha', 'C40 II', 'guitares-classiques', 149, ['Natural'], { Taille: '4/4', Table: 'Épicéa', 'Dos & éclisses': 'Meranti', Touche: 'Palissandre', Cordes: 'Nylon' }],
  ['Alhambra', '3C Classical', 'guitares-classiques', 549, ['Natural'], { Taille: '4/4', Table: 'Cèdre massif', 'Dos & éclisses': 'Sapelli', Touche: 'Palissandre', Cordes: 'Nylon' }],
  ['Harley Benton', 'CG-200 3/4', 'guitares-classiques', 89, ['Natural'], { Taille: '3/4', Table: 'Épicéa', 'Dos & éclisses': 'Tilleul', Touche: 'Amarante', Cordes: 'Nylon' }],
  ['Cordoba', 'C5 Cedar', 'guitares-classiques', 379, ['Natural'], { Taille: '4/4', Table: 'Cèdre massif', 'Dos & éclisses': 'Acajou', Touche: 'Palissandre', Cordes: 'Nylon' }],
  ['Ortega', 'R121 Family Series', 'guitares-classiques', 199, ['Natural Satin'], { Taille: '4/4', Table: 'Épicéa', 'Dos & éclisses': 'Catalpa', Touche: 'Amarante', Cordes: 'Nylon' }],
  ['La Mancha', 'Rubinito CM 63', 'guitares-classiques', 259, ['Natural'], { Taille: '7/8', Table: 'Cèdre', 'Dos & éclisses': 'Sapelli', Touche: 'Palissandre', Cordes: 'Nylon' }],

  // ---------------------------------------------------------------- electric basses
  ['Fender', 'Player II Precision Bass', 'basses-electriques', 899, ['Black', '3-Color Sunburst'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Palissandre', Micros: 'Split Coil', Cordes: '4' }],
  ['Fender', 'American Pro II Jazz Bass V', 'basses-electriques', 2199, ['Olympic White', 'Dark Night'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Single Coil', Cordes: '5' }],
  ['Music Man', 'StingRay Special 4H', 'basses-electriques', 2899, ['Ivory White', 'Firemist Purple'], { Corps: 'Frêne', Manche: 'Érable rôti', Touche: 'Érable', Micros: 'Humbucker', Cordes: '4' }],
  ['Ibanez', 'SR300E', 'basses-electriques', 399, ['Iron Pewter', 'Pearl White'], { Corps: 'Peuplier', Manche: 'Érable/Noyer', Touche: 'Jatoba', Micros: '2x PowerSpan', Cordes: '4' }],
  ['Harley Benton', 'PB-50 Vintage Series', 'basses-electriques', 155, ['Vintage Sunburst', 'Sea Foam Green'], { Corps: 'Tilleul', Manche: 'Érable', Touche: 'Amarante', Micros: 'Split Coil', Cordes: '4' }],
  ['Höfner', 'Ignition Bass SB', 'basses-electriques', 419, ['Sunburst'], { Corps: 'Épicéa/Érable', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Staple', Cordes: '4' }],
  ['Yamaha', 'TRBX304', 'basses-electriques', 379, ['Mist Green', 'Black'], { Corps: 'Acajou', Manche: 'Érable/Acajou', Touche: 'Palissandre', Micros: 'P/J actif', Cordes: '4' }],
  ['Cort', 'Action DLX AS', 'basses-electriques', 349, ['Open Pore Natural'], { Corps: 'Frêne', Manche: 'Érable', Touche: 'Jatoba', Micros: 'PJ actif', Cordes: '4' }],

  // ---------------------------------------------------------------- guitar amps
  ['Fender', 'Blues Junior IV', 'amplis-guitare', 749, ['Black Tolex', 'Tweed'], { Type: 'Lampes', Puissance: '15 W', 'Haut-parleur': '1x12"', Canaux: '1', Réverbe: 'Oui' }],
  ['Marshall', 'DSL40CR', 'amplis-guitare', 899, ['Black'], { Type: 'Lampes', Puissance: '40 W', 'Haut-parleur': '1x12"', Canaux: '2', Réverbe: 'Oui' }],
  ['Boss', 'Katana-50 MkII', 'amplis-guitare', 279, ['Black'], { Type: 'Modélisation', Puissance: '50 W', 'Haut-parleur': '1x12"', Canaux: '5', Effets: '60+' }],
  ['Orange', 'Crush 20RT', 'amplis-guitare', 189, ['Orange', 'Black'], { Type: 'Transistor', Puissance: '20 W', 'Haut-parleur': '1x8"', Canaux: '2', Réverbe: 'Oui' }],
  ['Vox', 'AC15C1', 'amplis-guitare', 799, ['Black'], { Type: 'Lampes', Puissance: '15 W', 'Haut-parleur': '1x12"', Canaux: '2', Trémolo: 'Oui' }],
  ['Blackstar', 'HT-5R MkIII', 'amplis-guitare', 429, ['Black'], { Type: 'Lampes', Puissance: '5 W', 'Haut-parleur': '1x12"', Canaux: '2', Réverbe: 'Oui' }],
  ['Harley Benton', 'HB-20R', 'amplis-guitare', 79, ['Black'], { Type: 'Transistor', Puissance: '20 W', 'Haut-parleur': '1x8"', Canaux: '2', Réverbe: 'Oui' }],
  ['Positive Grid', 'Spark 40', 'amplis-guitare', 299, ['Black', 'Pearl'], { Type: 'Modélisation', Puissance: '40 W', 'Haut-parleur': '2x4"', Bluetooth: 'Oui', App: 'Oui' }],

  // ---------------------------------------------------------------- bass amps
  ['Ampeg', 'Rocket Bass RB-115', 'amplis-basse', 549, ['Black'], { Type: 'Combo', Puissance: '200 W', 'Haut-parleur': '1x15"', DI: 'Oui' }],
  ['Markbass', 'CMD 121P', 'amplis-basse', 899, ['Black/Yellow'], { Type: 'Combo', Puissance: '300 W', 'Haut-parleur': '1x12"', Poids: '13 kg' }],
  ['Fender', 'Rumble 100 V3', 'amplis-basse', 349, ['Black/Silver'], { Type: 'Combo', Puissance: '100 W', 'Haut-parleur': '1x12"', Overdrive: 'Oui' }],
  ['Hartke', 'HD75', 'amplis-basse', 299, ['Black'], { Type: 'Combo', Puissance: '75 W', 'Haut-parleur': '1x12"', EQ: '3 bandes' }],
  ['Harley Benton', 'BA-40B', 'amplis-basse', 129, ['Black'], { Type: 'Combo', Puissance: '40 W', 'Haut-parleur': '1x10"', EQ: '3 bandes' }],
  ['Gallien-Krueger', 'MB110', 'amplis-basse', 429, ['Black'], { Type: 'Combo', Puissance: '100 W', 'Haut-parleur': '1x10"', Poids: '10 kg' }],

  // ---------------------------------------------------------------- effect pedals
  ['Boss', 'DS-1 Distortion', 'pedales-effets', 59, ['Orange'], { Type: 'Distorsion', Alimentation: '9 V', 'True Bypass': 'Non', Réglages: '3' }],
  ['Ibanez', 'TS9 Tube Screamer', 'pedales-effets', 109, ['Green'], { Type: 'Overdrive', Alimentation: '9 V', 'True Bypass': 'Non', Réglages: '3' }],
  ['Electro Harmonix', 'Big Muff Pi', 'pedales-effets', 89, ['Silver'], { Type: 'Fuzz', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '3' }],
  ['Strymon', 'BigSky MX', 'pedales-effets', 679, ['Blue'], { Type: 'Réverbe', Alimentation: '9 V', 'True Bypass': 'Sélectionnable', Presets: '300' }],
  ['MXR', 'M234 Analog Chorus', 'pedales-effets', 119, ['Silver'], { Type: 'Chorus', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '4' }],
  ['Dunlop', 'Cry Baby GCB95', 'pedales-effets', 99, ['Black'], { Type: 'Wah', Alimentation: '9 V', 'True Bypass': 'Non', Format: 'Pédale' }],
  ['TC Electronic', 'Polytune 3', 'pedales-effets', 89, ['Blue'], { Type: 'Accordeur', Alimentation: '9 V', 'True Bypass': 'Oui', Buffer: 'Oui' }],
  ['Harley Benton', 'Vintage Overdrive', 'pedales-effets', 29, ['Green'], { Type: 'Overdrive', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '3' }],
  ['Line 6', 'HX Stomp XL', 'pedales-effets', 749, ['Black'], { Type: 'Multi-effets', Alimentation: '9 V DC', Blocs: '8', 'IR': 'Oui' }],

  // ---------------------------------------------------------------- strings
  ['Daddario', 'EXL110 Nickel Wound 10-46', 'cordes', 9, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '010-046', Matière: 'Nickel', Jeux: '1' }],
  ['Ernie Ball', 'Regular Slinky 10-46', 'cordes', 8, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '010-046', Matière: 'Nickel', Jeux: '1' }],
  ['Ernie Ball', 'Super Slinky 3-Pack', 'cordes', 22, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '009-042', Matière: 'Nickel', Jeux: '3' }],
  ['Elixir', 'Nanoweb Phosphor Bronze 12-53', 'cordes', 19, ['Standard'], { Instrument: 'Guitare acoustique', Tirant: '012-053', Matière: 'Bronze phosphoreux', Traitement: 'Nanoweb' }],
  ['Daddario', 'EXL170 Bass 45-100', 'cordes', 24, ['Standard'], { Instrument: 'Basse 4 cordes', Tirant: '045-100', Matière: 'Nickel', Jeux: '1' }],
  ['Savarez', '520R Classical Normal', 'cordes', 11, ['Standard'], { Instrument: 'Guitare classique', Tension: 'Normale', Matière: 'Nylon', Jeux: '1' }],
  ['Rotosound', 'Swing Bass 66 45-105', 'cordes', 29, ['Standard'], { Instrument: 'Basse 4 cordes', Tirant: '045-105', Matière: 'Acier inox', Jeux: '1' }],

  // ---------------------------------------------------------------- accessories
  ['Fender', 'Deluxe Molded Strat Case', 'accessoires', 149, ['Black'], { Type: 'Étui rigide', Compatibilité: 'Stratocaster/Telecaster', Poids: '3.9 kg' }],
  ['Hercules', 'GS414B Plus Stand', 'accessoires', 55, ['Black'], { Type: 'Stand', Instrument: 'Guitare/Basse', Système: 'Auto Grip' }],
  ['Dunlop', 'Tortex Standard .88 Pack 12', 'accessoires', 7, ['Green'], { Type: 'Médiators', Épaisseur: '0.88 mm', Quantité: '12' }],
  ['Boss', 'PSA-230ES Adapter', 'accessoires', 29, ['Black'], { Type: 'Alimentation', Tension: '9 V DC', Intensité: '200 mA' }],
  ['Cordial', 'CSI 6 PP Cable 6m', 'accessoires', 32, ['Black'], { Type: 'Câble jack', Longueur: '6 m', Connecteurs: 'Jack/Jack' }],
  ['Shure', 'GLXD16+ Wireless', 'accessoires', 699, ['Black'], { Type: 'Système sans fil', Bande: '2.4/5.8 GHz', Autonomie: '12 h' }],
  ['Ernie Ball', 'Polypro Strap Black', 'accessoires', 12, ['Black', 'Red'], { Type: 'Sangle', Longueur: '96-152 cm', Matière: 'Polypropylène' }],
  ['Planet Waves', 'Pro-Winder String Winder', 'accessoires', 14, ['Black'], { Type: 'Outil', Fonctions: 'Bobineur/Coupe-cordes', Compatibilité: 'Universelle' }],
];

const products = CATALOG.map(([brand, model, category, priceEur, colors, specs], index) => {
  const sku = `${skuPart(brand, 3)}-${skuPart(model, 6)}-${String(index + 1).padStart(3, '0')}`;
  const rand = mulberry32(xmur3(sku)());

  // Roughly a third of the catalog carries a discount, biased towards accessories
  // and entry-level gear the way a real store's "hot deals" section behaves.
  const hasDiscount = rand() < 0.34;
  const discountPct = hasDiscount ? [5, 10, 15, 20, 25, 30][Math.floor(rand() * 6)] : 0;
  const listPrice = Math.round(priceEur * 100);
  const price = hasDiscount ? Math.round((listPrice * (100 - discountPct)) / 100) : listPrice;

  const stockRoll = rand();
  // ~8% of the catalog is out of stock so the "in stock only" facet has something
  // to filter, and the product page has an unavailable state to assert on.
  const stock = stockRoll < 0.08 ? 0 : Math.floor(rand() * 40) + 1;

  const reviewCount = Math.floor(rand() * 240);
  const rating = reviewCount === 0 ? 0 : Math.round((3 + rand() * 2) * 10) / 10;

  // Release dates spread over the last three years, anchored so the generator is
  // reproducible regardless of when it runs.
  const daysAgo = Math.floor(rand() * 1095);
  const releasedAt = new Date(Date.UTC(2026, 0, 1) - daysAgo * 86400000).toISOString().slice(0, 10);

  return {
    id: `PRD-${String(index + 1).padStart(4, '0')}`,
    sku,
    slug: slugify(`${brand}-${model}`),
    name: model,
    brand,
    category,
    price,
    listPrice: hasDiscount ? listPrice : null,
    discountPct,
    currency: 'EUR',
    stock,
    rating,
    reviewCount,
    releasedAt,
    bestSeller: rand() < 0.18,
    isNew: daysAgo < 180,
    leftHanded: rand() < 0.15,
    colors,
    specs,
    description: buildDescription(brand, model, category, specs),
  };
});

function buildDescription(brand, model, category, specs) {
  const intro = {
    'guitares-electriques': `La ${brand} ${model} reprend les codes qui ont fait l'histoire de la guitare électrique, avec une lutherie soignée et un rapport qualité/prix maîtrisé.`,
    'guitares-acoustiques': `La ${brand} ${model} offre une projection généreuse et un équilibre tonal adapté aussi bien à l'accompagnement qu'au fingerpicking.`,
    'guitares-classiques': `La ${brand} ${model} propose un toucher souple et un timbre chaleureux, idéale pour l'apprentissage comme pour le répertoire classique.`,
    'basses-electriques': `La ${brand} ${model} délivre un grave profond et une définition qui se tient dans le mix, quel que soit le style abordé.`,
    'amplis-guitare': `Le ${brand} ${model} couvre un large éventail de sons, du clair cristallin à la saturation dense, dans un format transportable.`,
    'amplis-basse': `Le ${brand} ${model} allie puissance et lisibilité, avec l'égalisation nécessaire pour s'adapter à n'importe quelle salle.`,
    'pedales-effets': `La ${brand} ${model} est une référence de sa catégorie : réglages directs, réponse musicale et fabrication robuste.`,
    cordes: `Les cordes ${brand} ${model} garantissent une tenue d'accord fiable et un rendu constant jeu après jeu.`,
    accessoires: `${brand} ${model} : un accessoire pensé pour durer, conçu pour l'usage quotidien sur scène comme au studio.`,
  }[category];

  const specLine = Object.entries(specs)
    .slice(0, 3)
    .map(([key, value]) => `${key} : ${value}`)
    .join(' · ');

  return `${intro} ${specLine}.`;
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(products, null, 2)}\n`, 'utf8');

console.log(`Generated ${products.length} products → ${OUTPUT}`);
