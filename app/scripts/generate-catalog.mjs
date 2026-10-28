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
 * Source table: [brand, model, category, price (EUR, VAT included), colors, specs, metaDescription]
 * Prices are stored in cents downstream — see src/lib/money.ts for the rationale.
 *
 * `metaDescription` is written by hand, not derived like `description`: it is the
 * snippet a search engine shows, cut off past ~155 characters, and the generated
 * description runs 170 to 225. A template trimmed to fit reads as one; the cap is
 * enforced by check-catalog.mjs. It names no price — a discount would make it lie.
 */
const CATALOG = [
  // ---------------------------------------------------------------- electric guitars
  ['Fender', 'Player II Stratocaster MN', 'guitares-electriques', 849, ['Sunburst', 'Noir', 'Blanc Vintage'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Érable', Micros: '3x Single Coil', Frettes: '22' }, 'Stratocaster Player II à manche érable : corps aulne, trois micros simple bobinage et 22 frettes pour le son Fender clair et incisif.'],
  ['Fender', 'American Pro III Telecaster', 'guitares-electriques', 1899, ['Butterscotch', 'Noir'], { Corps: 'Frêne', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Single Coil', Frettes: '22' }, 'Telecaster American Professional III : corps frêne, touche palissandre et deux simples bobinages. Le twang Fender, fabriqué aux États-Unis.'],
  ['Gibson', 'Les Paul Standard 60s', 'guitares-electriques', 2799, ['Bourbon Burst', 'Ebony'], { Corps: 'Acajou', Table: 'Érable flammé', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '22' }, 'Les Paul Standard 60s : corps acajou, table érable flammé et deux humbuckers. Le manche et le son des Gibson du début des années 60.'],
  ['Gibson', 'SG Standard', 'guitares-electriques', 1899, ['Heritage Cherry', 'Ebony'], { Corps: 'Acajou', Manche: 'Acajou', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '22' }, 'Gibson SG Standard : corps et manche acajou, deux humbuckers et une double découpe qui libère l’accès aux aigus. Un classique du rock.'],
  ['Epiphone', 'Les Paul Classic', 'guitares-electriques', 699, ['Honey Burst', 'Ebony'], { Corps: 'Acajou', Table: 'Érable', Touche: 'Laurier', Micros: '2x Humbucker', Frettes: '22' }, 'Epiphone Les Paul Classic : corps acajou, table érable et deux humbuckers. La silhouette Les Paul à un prix accessible.'],
  ['Squier', 'Classic Vibe 60s Stratocaster', 'guitares-electriques', 429, ['Lake Placid Blue', 'Sunburst'], { Corps: 'Peuplier', Manche: 'Érable', Touche: 'Laurier', Micros: '3x Single Coil', Frettes: '21' }, 'Squier Classic Vibe 60s Stratocaster : trois simples bobinages, touche laurier et 21 frettes pour un son Strat vintage à petit budget.'],
  ['Ibanez', 'RG550 Genesis', 'guitares-electriques', 1099, ['Desert Sun Yellow', 'Purple Neon'], { Corps: 'Tilleul', Manche: 'Érable/Noyer', Touche: 'Érable', Micros: 'HSH', Frettes: '24' }, 'Ibanez RG550 Genesis : corps tilleul, manche fin érable/noyer, 24 frettes et micros HSH. La guitare de shred des années 80, rééditée.'],
  ['Ibanez', 'AZ2402 Prestige', 'guitares-electriques', 2299, ['Ice Blue', 'Black Flat'], { Corps: 'Aulne', Manche: 'Érable rôti', Touche: 'Érable', Micros: '2x Humbucker', Frettes: '24' }, 'Ibanez AZ2402 Prestige : manche érable rôti, 24 frettes et deux humbuckers. Une guitare japonaise polyvalente au jeu très confortable.'],
  ['PRS', 'SE Custom 24', 'guitares-electriques', 949, ['Faded Blue', 'Charcoal Burst'], { Corps: 'Acajou', Table: 'Érable', Touche: 'Palissandre', Micros: '2x Humbucker', Frettes: '24' }, 'PRS SE Custom 24 : corps acajou, table érable, deux humbuckers et 24 frettes. La PRS emblématique dans sa version abordable.'],
  ['Harley Benton', 'ST-62 Vintage Series', 'guitares-electriques', 165, ['Sunburst', 'Noir', 'Rouge'], { Corps: 'Tilleul', Manche: 'Érable', Touche: 'Laurier', Micros: '3x Single Coil', Frettes: '21' }, 'Harley Benton ST-62 : corps tilleul, trois simples bobinages et touche laurier. Une guitare de type Strat pour débuter sans se ruiner.'],
  ['ESP', 'LTD EC-256', 'guitares-electriques', 549, ['Black Satin', 'Snow White'], { Corps: 'Acajou', Manche: 'Acajou', Touche: 'Jatoba', Micros: '2x Humbucker', Frettes: '22' }, 'ESP LTD EC-256 : corps et manche acajou, deux humbuckers et touche jatoba. Une simple découpe taillée pour le rock et le metal.'],
  ['Jackson', 'Pro Series Soloist SL2', 'guitares-electriques', 1249, ['Riviera Blue', 'Black'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Ébène', Micros: '2x Humbucker', Frettes: '24' }, 'Jackson Soloist SL2 : manche érable, touche ébène, deux humbuckers et 24 frettes. Une guitare de metal rapide et précise.'],
  ['Gretsch', 'G2622 Streamliner', 'guitares-electriques', 549, ['Walnut Stain', 'Torino Green'], { Corps: 'Érable laminé', Manche: 'Nato', Touche: 'Laurier', Micros: '2x Broad’Tron', Frettes: '22' }, 'Gretsch G2622 Streamliner : demi-caisse en érable laminé et deux micros Broad’Tron. Le son Gretsch, du rockabilly au rock garage.'],

  // ---------------------------------------------------------------- acoustic guitars
  ['Martin Guitar', 'D-28 Standard', 'guitares-acoustiques', 3399, ['Natural'], { Format: 'Dreadnought', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Palissandre', Touche: 'Ébène', Électronique: 'Non' }, 'Martin D-28 Standard : dreadnought en épicéa Sitka et palissandre, touche ébène. La référence de la guitare folk, sans électronique.'],
  ['Taylor', '214ce Plus', 'guitares-acoustiques', 1449, ['Natural'], { Format: 'Grand Auditorium', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Koa laminé', Touche: 'Ébène', Électronique: 'Expression System 2' }, 'Taylor 214ce Plus : grand auditorium en épicéa Sitka et koa laminé, pan coupé et électronique Expression System 2 pour la scène.'],
  ['Yamaha', 'FG800M', 'guitares-acoustiques', 229, ['Natural Matte'], { Format: 'Dreadnought', Table: 'Épicéa massif', 'Dos & éclisses': 'Nato', Touche: 'Palissandre', Électronique: 'Non' }, 'Yamaha FG800M : dreadnought à table épicéa massif, dos et éclisses nato. Une guitare acoustique fiable et abordable pour bien débuter.'],
  ['Harley Benton', 'D-120CE', 'guitares-acoustiques', 139, ['Natural', 'Black'], { Format: 'Dreadnought Cutaway', Table: 'Épicéa', 'Dos & éclisses': 'Acajou', Touche: 'Amarante', Électronique: 'Oui' }, 'Harley Benton D-120CE : dreadnought à pan coupé, table épicéa et électronique intégrée. Une électro-acoustique d’entrée de gamme.'],
  ['Gibson', 'J-45 Studio Walnut', 'guitares-acoustiques', 2199, ['Walnut Burst'], { Format: 'Round Shoulder', Table: 'Épicéa Sitka', 'Dos & éclisses': 'Noyer', Touche: 'Palissandre', Électronique: 'LR Baggs VTC' }, 'Gibson J-45 Studio Walnut : épaules arrondies, table épicéa Sitka, dos noyer et micro LR Baggs VTC. Le classique acoustique de Gibson.'],
  ['Cort', 'Earth 70 OP', 'guitares-acoustiques', 259, ['Open Pore Natural'], { Format: 'Dreadnought', Table: 'Épicéa massif', 'Dos & éclisses': 'Acajou', Touche: 'Merbau', Électronique: 'Non' }, 'Cort Earth 70 OP : dreadnought à table épicéa massif, dos et éclisses acajou, finition pores ouverts. Une guitare folk à petit prix.'],
  ['Fender', 'CD-60SCE All Mahogany', 'guitares-acoustiques', 289, ['Natural Mahogany'], { Format: 'Dreadnought Cutaway', Table: 'Acajou', 'Dos & éclisses': 'Acajou', Touche: 'Laurier', Électronique: 'Fishman' }, 'Fender CD-60SCE All Mahogany : dreadnought à pan coupé tout acajou et préampli Fishman. Un son chaud et doux, prêt à brancher.'],
  ['Takamine', 'GD30CE-NAT', 'guitares-acoustiques', 429, ['Natural'], { Format: 'Dreadnought Cutaway', Table: 'Épicéa massif', 'Dos & éclisses': 'Acajou', Touche: 'Laurier', Électronique: 'TP-4TD' }, 'Takamine GD30CE : dreadnought à pan coupé, table épicéa massif, dos acajou et préampli TP-4TD avec accordeur intégré.'],

  // ---------------------------------------------------------------- classical guitars
  ['Yamaha', 'C40 II', 'guitares-classiques', 149, ['Natural'], { Taille: '4/4', Table: 'Épicéa', 'Dos & éclisses': 'Meranti', Touche: 'Palissandre', Cordes: 'Nylon' }, 'Yamaha C40 II : guitare classique 4/4 à table épicéa et cordes nylon. Le modèle de référence pour apprendre la guitare.'],
  ['Alhambra', '3C Classical', 'guitares-classiques', 549, ['Natural'], { Taille: '4/4', Table: 'Cèdre massif', 'Dos & éclisses': 'Sapelli', Touche: 'Palissandre', Cordes: 'Nylon' }, 'Alhambra 3C : guitare classique espagnole 4/4, table cèdre massif et dos sapelli. Un son chaud pour poursuivre l’étude.'],
  ['Harley Benton', 'CG-200 3/4', 'guitares-classiques', 89, ['Natural'], { Taille: '3/4', Table: 'Épicéa', 'Dos & éclisses': 'Tilleul', Touche: 'Amarante', Cordes: 'Nylon' }, 'Harley Benton CG-200 3/4 : guitare classique taille 3/4 à cordes nylon, adaptée aux enfants et aux débuts à petit budget.'],
  ['Cordoba', 'C5 Cedar', 'guitares-classiques', 379, ['Natural'], { Taille: '4/4', Table: 'Cèdre massif', 'Dos & éclisses': 'Acajou', Touche: 'Palissandre', Cordes: 'Nylon' }, 'Cordoba C5 Cedar : guitare classique 4/4, table cèdre massif, dos et éclisses acajou. Un timbre chaleureux et un manche confortable.'],
  ['Ortega', 'R121 Family Series', 'guitares-classiques', 199, ['Natural Satin'], { Taille: '4/4', Table: 'Épicéa', 'Dos & éclisses': 'Catalpa', Touche: 'Amarante', Cordes: 'Nylon' }, 'Ortega R121 : guitare classique 4/4 de la Family Series, table épicéa et dos catalpa. Légère et facile à jouer pour débuter.'],
  ['La Mancha', 'Rubinito CM 63', 'guitares-classiques', 259, ['Natural'], { Taille: '7/8', Table: 'Cèdre', 'Dos & éclisses': 'Sapelli', Touche: 'Palissandre', Cordes: 'Nylon' }, 'La Mancha Rubinito CM 63 : guitare classique 7/8 à table cèdre et dos sapelli. Une taille intermédiaire pour les petites mains.'],

  // ---------------------------------------------------------------- electric basses
  ['Fender', 'Player II Precision Bass', 'basses-electriques', 899, ['Black', '3-Color Sunburst'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Palissandre', Micros: 'Split Coil', Cordes: '4' }, 'Fender Player II Precision Bass : corps aulne, micro split coil et 4 cordes. Le grave rond et puissant de la P-Bass.'],
  ['Fender', 'American Pro II Jazz Bass V', 'basses-electriques', 2199, ['Olympic White', 'Dark Night'], { Corps: 'Aulne', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Single Coil', Cordes: '5' }, 'Fender American Pro II Jazz Bass V : basse 5 cordes, corps aulne et deux simples bobinages. Le son Jazz Bass étendu dans le grave.'],
  ['Music Man', 'StingRay Special 4H', 'basses-electriques', 2899, ['Ivory White', 'Firemist Purple'], { Corps: 'Frêne', Manche: 'Érable rôti', Touche: 'Érable', Micros: 'Humbucker', Cordes: '4' }, 'Music Man StingRay Special 4H : corps frêne, manche érable rôti et humbucker. Le punch de la StingRay dans sa version modernisée.'],
  ['Ibanez', 'SR300E', 'basses-electriques', 399, ['Iron Pewter', 'Pearl White'], { Corps: 'Peuplier', Manche: 'Érable/Noyer', Touche: 'Jatoba', Micros: '2x PowerSpan', Cordes: '4' }, 'Ibanez SR300E : basse 4 cordes au manche fin, deux micros PowerSpan et préampli actif. Légère et polyvalente, pour tous les styles.'],
  ['Harley Benton', 'PB-50 Vintage Series', 'basses-electriques', 155, ['Vintage Sunburst', 'Sea Foam Green'], { Corps: 'Tilleul', Manche: 'Érable', Touche: 'Amarante', Micros: 'Split Coil', Cordes: '4' }, 'Harley Benton PB-50 : basse de type Precision, corps tilleul et micro split coil. Une 4 cordes vintage pour débuter à petit prix.'],
  ['Höfner', 'Ignition Bass SB', 'basses-electriques', 419, ['Sunburst'], { Corps: 'Épicéa/Érable', Manche: 'Érable', Touche: 'Palissandre', Micros: '2x Staple', Cordes: '4' }, 'Höfner Ignition Bass SB : la basse violon à deux micros Staple et manche court. La silhouette et le son des années 60.'],
  ['Yamaha', 'TRBX304', 'basses-electriques', 379, ['Mist Green', 'Black'], { Corps: 'Acajou', Manche: 'Érable/Acajou', Touche: 'Palissandre', Micros: 'P/J actif', Cordes: '4' }, 'Yamaha TRBX304 : basse 4 cordes à corps acajou et micros P/J actifs. Une basse équilibrée et polyvalente, de la répétition à la scène.'],
  ['Cort', 'Action DLX AS', 'basses-electriques', 349, ['Open Pore Natural'], { Corps: 'Frêne', Manche: 'Érable', Touche: 'Jatoba', Micros: 'PJ actif', Cordes: '4' }, 'Cort Action DLX AS : basse 4 cordes à corps frêne et micros PJ actifs. Une basse polyvalente au rapport qualité-prix soigné.'],

  // ---------------------------------------------------------------- guitar amps
  ['Fender', 'Blues Junior IV', 'amplis-guitare', 749, ['Black Tolex', 'Tweed'], { Type: 'Lampes', Puissance: '15 W', 'Haut-parleur': '1x12"', Canaux: '1', Réverbe: 'Oui' }, 'Fender Blues Junior IV : ampli à lampes 15 W, haut-parleur 12" et réverbe. Le combo blues compact, du son clair au crunch.'],
  ['Marshall', 'DSL40CR', 'amplis-guitare', 899, ['Black'], { Type: 'Lampes', Puissance: '40 W', 'Haut-parleur': '1x12"', Canaux: '2', Réverbe: 'Oui' }, 'Marshall DSL40CR : combo à lampes 40 W, deux canaux, réverbe et haut-parleur 12". Le son Marshall, du crunch au gain élevé.'],
  ['Boss', 'Katana-50 MkII', 'amplis-guitare', 279, ['Black'], { Type: 'Modélisation', Puissance: '50 W', 'Haut-parleur': '1x12"', Canaux: '5', Effets: '60+' }, 'Boss Katana-50 MkII : ampli à modélisation 50 W, haut-parleur 12", cinq types d’ampli et plus de 60 effets, de la maison à la répétition.'],
  ['Orange', 'Crush 20RT', 'amplis-guitare', 189, ['Orange', 'Black'], { Type: 'Transistor', Puissance: '20 W', 'Haut-parleur': '1x8"', Canaux: '2', Réverbe: 'Oui' }, 'Orange Crush 20RT : ampli transistor 20 W, deux canaux, réverbe et accordeur intégré. Le son Orange pour travailler à la maison.'],
  ['Vox', 'AC15C1', 'amplis-guitare', 799, ['Black'], { Type: 'Lampes', Puissance: '15 W', 'Haut-parleur': '1x12"', Canaux: '2', Trémolo: 'Oui' }, 'Vox AC15C1 : combo à lampes 15 W, haut-parleur 12", deux canaux, réverbe et trémolo. Le son britannique de la classe A.'],
  ['Blackstar', 'HT-5R MkIII', 'amplis-guitare', 429, ['Black'], { Type: 'Lampes', Puissance: '5 W', 'Haut-parleur': '1x12"', Canaux: '2', Réverbe: 'Oui' }, 'Blackstar HT-5R MkIII : ampli à lampes 5 W, deux canaux, réverbe et haut-parleur 12". Le son lampes à volume d’appartement.'],
  ['Harley Benton', 'HB-20R', 'amplis-guitare', 79, ['Black'], { Type: 'Transistor', Puissance: '20 W', 'Haut-parleur': '1x8"', Canaux: '2', Réverbe: 'Oui' }, 'Harley Benton HB-20R : ampli transistor 20 W, deux canaux et réverbe. Un petit combo pour travailler chez soi sans se ruiner.'],
  ['Positive Grid', 'Spark 40', 'amplis-guitare', 299, ['Black', 'Pearl'], { Type: 'Modélisation', Puissance: '40 W', 'Haut-parleur': '2x4"', Bluetooth: 'Oui', App: 'Oui' }, 'Positive Grid Spark 40 : ampli à modélisation 40 W, Bluetooth et application mobile. Pour jouer sur des morceaux et explorer les sons.'],

  // ---------------------------------------------------------------- bass amps
  ['Ampeg', 'Rocket Bass RB-115', 'amplis-basse', 549, ['Black'], { Type: 'Combo', Puissance: '200 W', 'Haut-parleur': '1x15"', DI: 'Oui' }, 'Ampeg Rocket Bass RB-115 : combo basse 200 W, haut-parleur 15" et sortie DI. Le grave Ampeg, de la répétition à la petite scène.'],
  ['Markbass', 'CMD 121P', 'amplis-basse', 899, ['Black/Yellow'], { Type: 'Combo', Puissance: '300 W', 'Haut-parleur': '1x12"', Poids: '13 kg' }, 'Markbass CMD 121P : combo basse 300 W en 12" pour 13 kg. Un ampli puissant et facile à transporter.'],
  ['Fender', 'Rumble 100 V3', 'amplis-basse', 349, ['Black/Silver'], { Type: 'Combo', Puissance: '100 W', 'Haut-parleur': '1x12"', Overdrive: 'Oui' }, 'Fender Rumble 100 V3 : combo basse 100 W, haut-parleur 12" et overdrive intégré. Léger, simple et assez fort pour répéter.'],
  ['Hartke', 'HD75', 'amplis-basse', 299, ['Black'], { Type: 'Combo', Puissance: '75 W', 'Haut-parleur': '1x12"', EQ: '3 bandes' }, 'Hartke HD75 : combo basse 75 W, haut-parleur 12" et égaliseur 3 bandes. Un ampli compact pour s’entraîner.'],
  ['Harley Benton', 'BA-40B', 'amplis-basse', 129, ['Black'], { Type: 'Combo', Puissance: '40 W', 'Haut-parleur': '1x10"', EQ: '3 bandes' }, 'Harley Benton BA-40B : combo basse 40 W, haut-parleur 10" et égaliseur 3 bandes. Un petit ampli pour débuter à la maison.'],
  ['Gallien-Krueger', 'MB110', 'amplis-basse', 429, ['Black'], { Type: 'Combo', Puissance: '100 W', 'Haut-parleur': '1x10"', Poids: '10 kg' }, 'Gallien-Krueger MB110 : combo basse 100 W en 10" pour 10 kg. Le son GK dans un format très compact.'],

  // ---------------------------------------------------------------- effect pedals
  ['Boss', 'DS-1 Distortion', 'pedales-effets', 59, ['Orange'], { Type: 'Distorsion', Alimentation: '9 V', 'True Bypass': 'Non', Réglages: '3' }, 'Boss DS-1 Distortion : pédale de distorsion à trois réglages, alimentée en 9 V. La distorsion orange, classique du rock.'],
  ['Ibanez', 'TS9 Tube Screamer', 'pedales-effets', 109, ['Green'], { Type: 'Overdrive', Alimentation: '9 V', 'True Bypass': 'Non', Réglages: '3' }, 'Ibanez TS9 Tube Screamer : overdrive à trois réglages qui met les médiums en avant. La pédale de référence pour pousser un ampli.'],
  ['Electro Harmonix', 'Big Muff Pi', 'pedales-effets', 89, ['Silver'], { Type: 'Fuzz', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '3' }, 'Electro Harmonix Big Muff Pi : fuzz à trois réglages en true bypass. Un sustain épais et un grain massif, du rock psyché au stoner.'],
  ['Strymon', 'BigSky MX', 'pedales-effets', 679, ['Blue'], { Type: 'Réverbe', Alimentation: '9 V', 'True Bypass': 'Sélectionnable', Presets: '300' }, 'Strymon BigSky MX : réverbe haut de gamme, 300 presets et true bypass sélectionnable. Des salles, des ressorts et des nappes de studio.'],
  ['MXR', 'M234 Analog Chorus', 'pedales-effets', 119, ['Silver'], { Type: 'Chorus', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '4' }, 'MXR M234 Analog Chorus : chorus analogique à quatre réglages en true bypass. Une modulation chaude et ample.'],
  ['Dunlop', 'Cry Baby GCB95', 'pedales-effets', 99, ['Black'], { Type: 'Wah', Alimentation: '9 V', 'True Bypass': 'Non', Format: 'Pédale' }, 'Dunlop Cry Baby GCB95 : la pédale wah standard, alimentée en 9 V. Le son wah des années 60 à aujourd’hui.'],
  ['TC Electronic', 'Polytune 3', 'pedales-effets', 89, ['Blue'], { Type: 'Accordeur', Alimentation: '9 V', 'True Bypass': 'Oui', Buffer: 'Oui' }, 'TC Electronic Polytune 3 : accordeur polyphonique en true bypass avec buffer intégré. Toutes les cordes s’accordent d’un seul coup.'],
  ['Harley Benton', 'Vintage Overdrive', 'pedales-effets', 29, ['Green'], { Type: 'Overdrive', Alimentation: '9 V', 'True Bypass': 'Oui', Réglages: '3' }, 'Harley Benton Vintage Overdrive : overdrive à trois réglages en true bypass. Une saturation de type Tube Screamer à tout petit prix.'],
  ['Line 6', 'HX Stomp XL', 'pedales-effets', 749, ['Black'], { Type: 'Multi-effets', Alimentation: '9 V DC', Blocs: '8', 'IR': 'Oui' }, 'Line 6 HX Stomp XL : multi-effets compact à 8 blocs simultanés, avec chargement d’IR. Toute une chaîne d’effets au pied.'],

  // ---------------------------------------------------------------- strings
  ['Daddario', 'EXL110 Nickel Wound 10-46', 'cordes', 9, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '010-046', Matière: 'Nickel', Jeux: '1' }, 'Daddario EXL110 10-46 : jeu de cordes électriques en nickel, tirant regular light. La référence polyvalente pour guitare électrique.'],
  ['Ernie Ball', 'Regular Slinky 10-46', 'cordes', 8, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '010-046', Matière: 'Nickel', Jeux: '1' }, 'Ernie Ball Regular Slinky 10-46 : cordes électriques en nickel. Le jeu Slinky de référence, au son brillant et équilibré.'],
  ['Ernie Ball', 'Super Slinky 3-Pack', 'cordes', 22, ['Standard'], { Instrument: 'Guitare électrique', Tirant: '009-042', Matière: 'Nickel', Jeux: '3' }, 'Ernie Ball Super Slinky 3-Pack : trois jeux de cordes électriques 9-42 en nickel. Un tirant léger pour des bends faciles.'],
  ['Elixir', 'Nanoweb Phosphor Bronze 12-53', 'cordes', 19, ['Standard'], { Instrument: 'Guitare acoustique', Tirant: '012-053', Matière: 'Bronze phosphoreux', Traitement: 'Nanoweb' }, 'Elixir Nanoweb Phosphor Bronze 12-53 : cordes acoustiques en bronze phosphoreux, avec un revêtement Nanoweb qui prolonge leur durée de vie.'],
  ['Daddario', 'EXL170 Bass 45-100', 'cordes', 24, ['Standard'], { Instrument: 'Basse 4 cordes', Tirant: '045-100', Matière: 'Nickel', Jeux: '1' }, 'Daddario EXL170 45-100 : jeu de cordes en nickel pour basse 4 cordes. Un son rond et une sensation souple sous les doigts.'],
  ['Savarez', '520R Classical Normal', 'cordes', 11, ['Standard'], { Instrument: 'Guitare classique', Tension: 'Normale', Matière: 'Nylon', Jeux: '1' }, 'Savarez 520R : jeu de cordes nylon pour guitare classique, tension normale. Un son clair et équilibré pour l’étude.'],
  ['Rotosound', 'Swing Bass 66 45-105', 'cordes', 29, ['Standard'], { Instrument: 'Basse 4 cordes', Tirant: '045-105', Matière: 'Acier inox', Jeux: '1' }, 'Rotosound Swing Bass 66 45-105 : cordes en acier inoxydable pour basse 4 cordes. Le son brillant et mordant des années 60 et 70.'],

  // ---------------------------------------------------------------- accessories
  ['Fender', 'Deluxe Molded Strat Case', 'accessoires', 149, ['Black'], { Type: 'Étui rigide', Compatibilité: 'Stratocaster/Telecaster', Poids: '3.9 kg' }, 'Fender Deluxe Molded Case : étui rigide de 3,9 kg pour Stratocaster et Telecaster. Protège la guitare en transport et en tournée.'],
  ['Hercules', 'GS414B Plus Stand', 'accessoires', 55, ['Black'], { Type: 'Stand', Instrument: 'Guitare/Basse', Système: 'Auto Grip' }, 'Hercules GS414B Plus : stand guitare ou basse avec système Auto Grip qui se referme sur le manche. Stable et sûr.'],
  ['Dunlop', 'Tortex Standard .88 Pack 12', 'accessoires', 7, ['Green'], { Type: 'Médiators', Épaisseur: '0.88 mm', Quantité: '12' }, 'Dunlop Tortex Standard .88 : 12 médiators de 0,88 mm à la prise antidérapante et à l’attaque nette. Un classique pour toutes les guitares.'],
  ['Boss', 'PSA-230ES Adapter', 'accessoires', 29, ['Black'], { Type: 'Alimentation', Tension: '9 V DC', Intensité: '200 mA' }, 'Boss PSA-230ES : alimentation 9 V DC 200 mA pour pédales Boss et compatibles. Remplace les piles sur le pedalboard.'],
  ['Cordial', 'CSI 6 PP Cable 6m', 'accessoires', 32, ['Black'], { Type: 'Câble jack', Longueur: '6 m', Connecteurs: 'Jack/Jack' }, 'Cordial CSI 6 PP : câble instrument jack/jack de 6 m. Un câble robuste pour relier guitare ou basse à l’ampli.'],
  ['Shure', 'GLXD16+ Wireless', 'accessoires', 699, ['Black'], { Type: 'Système sans fil', Bande: '2.4/5.8 GHz', Autonomie: '12 h' }, 'Shure GLXD16+ : système sans fil numérique pour guitare, bandes 2,4 et 5,8 GHz et 12 h d’autonomie. Le récepteur tient dans un format pédale.'],
  ['Ernie Ball', 'Polypro Strap Black', 'accessoires', 12, ['Black', 'Red'], { Type: 'Sangle', Longueur: '96-152 cm', Matière: 'Polypropylène' }, 'Ernie Ball Polypro : sangle en polypropylène réglable de 96 à 152 cm. Simple, légère et résistante.'],
  ['Planet Waves', 'Pro-Winder String Winder', 'accessoires', 14, ['Black'], { Type: 'Outil', Fonctions: 'Bobineur/Coupe-cordes', Compatibilité: 'Universelle' }, 'Planet Waves Pro-Winder : bobineur de cordes avec coupe-cordes intégré, compatible avec toutes les guitares. Pour changer de cordes en un instant.'],
];

const products = CATALOG.map(([brand, model, category, priceEur, colors, specs, metaDescription], index) => {
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
    metaDescription,
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
