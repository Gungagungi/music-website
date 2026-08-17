/**
 * Crée un fichier d'environnement s'il n'existe pas, en tirant au hasard les
 * valeurs qui sont des secrets.
 *
 *   node scripts/preparer-env.mjs               → .env, depuis .env.example
 *   node scripts/preparer-env.mjs --production  → .env.production, depuis .env.production.example
 *
 * Le hasard est le point : une clé de signature en clair dans un fichier
 * d'exemple finirait un jour recopiée sur un serveur, et personne ne s'en
 * apercevrait — c'est exactement la faille que la garde de lib/deployment.ts
 * cherche à empêcher. Une valeur par machine, jamais versionnée, ferme cette
 * porte sans rien coûter.
 *
 * Node plutôt qu'`openssl` : c'est la seule dépendance dont on soit certain.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');

const nom = production ? '.env.production' : '.env';
const modele = production ? '.env.production.example' : '.env.example';
const cible = join(repoRoot, nom);

const secret = (octets) => randomBytes(octets).toString('base64');

/**
 * True si la variable est présente ET renseignée.
 *
 * Espaces et tabulations, pas `\s` : `\s` couvre le saut de ligne, donc
 * `VARIABLE=` suivie d'une ligne quelconque paraissait renseignée — la valeur
 * trouvée était le premier caractère de la ligne d'après.
 */
const renseignee = (contenu, variable) =>
  new RegExp(String.raw`^[ \t]*${variable}[ \t]*=[ \t]*\S`, 'm').test(contenu);

const creation = !existsSync(cible);
if (creation) copyFileSync(join(repoRoot, modele), cible);

let contenu = readFileSync(cible, 'utf8');

if (production) {
  // Les modèles de production déclarent les variables sans valeur, pour que le
  // compose refuse de démarrer tant qu'on ne les a pas remplies. Les deux qui
  // sont de purs secrets n'ont aucune raison de demander une décision humaine :
  // on les remplit ici. FRETLINE_DOMAIN, si.
  const remplies = [];
  for (const [variable, octets] of [
    ['POSTGRES_PASSWORD', 24],
    ['AUTH_SECRET', 36],
  ]) {
    if (renseignee(contenu, variable)) continue;
    contenu = contenu.replace(
      new RegExp(String.raw`^[ \t]*${variable}[ \t]*=.*$`, 'm'),
      `${variable}=${secret(octets)}`,
    );
    remplies.push(variable);
  }
  if (remplies.length > 0) writeFileSync(cible, contenu);

  if (creation) console.log(`${nom} créé depuis ${modele}, mot de passe et clé tirés au hasard`);
  else if (remplies.length > 0) console.log(`${nom} complété : ${remplies.join(', ')}`);
  else console.log(`${nom} existe déjà — inchangé`);

  if (!renseignee(contenu, 'FRETLINE_DOMAIN')) {
    console.log(
      `\nÀ renseigner à la main dans ${nom} :\n` +
        '  FRETLINE_DOMAIN=exemple.fr   (nom de domaine public — Caddy obtient le certificat)\n' +
        '  FRETLINE_DOMAIN=:80          (essai local, sans TLS)',
    );
  }
} else {
  // Un `.env` existant est laissé tel quel, à une exception près : la clé de
  // signature. Elle est arrivée après coup, donc les fichiers créés avant ce
  // script n'en ont pas — et `npm start` refuserait de démarrer sans, avec une
  // erreur qui n'aide personne à comprendre qu'un fichier local est en retard.
  const aUneCle = renseignee(contenu, 'AUTH_SECRET');

  if (!aUneCle) {
    appendFileSync(
      cible,
      `\n# Générée à la création de ce fichier, propre à ce poste.\nAUTH_SECRET=${secret(36)}\n`,
    );
  }

  if (creation) console.log('.env créé depuis .env.example, avec une AUTH_SECRET tirée au hasard');
  else if (!aUneCle) console.log('.env complété : AUTH_SECRET tirée au hasard ajoutée');
  else console.log('.env existe déjà — inchangé');
}
