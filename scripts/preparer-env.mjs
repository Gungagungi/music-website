/**
 * Crée un fichier d'environnement s'il n'existe pas, en tirant au hasard les
 * valeurs qui sont des secrets.
 *
 *   node scripts/preparer-env.mjs               → .env, depuis .env.example
 *   node scripts/preparer-env.mjs --production  → .env.production, depuis .env.production.example
 *   ... --production --domain=:80               → renseigne aussi FRETLINE_DOMAIN
 *
 * Rien n'est jamais écrasé : une variable déjà renseignée est laissée telle
 * quelle, quel que soit le nombre de passages.
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
const domaine = process.argv.find((argument) => argument.startsWith('--domain='))?.slice(9);

const nom = production ? '.env.production' : '.env';
const modele = production ? '.env.production.example' : '.env.example';
const cible = join(repoRoot, nom);

/**
 * `base64url`, pas `base64`.
 *
 * POSTGRES_PASSWORD finit dans DATABASE_URL, et l'alphabet base64 contient `/`,
 * qui termine la section d'autorité d'une URL : le pilote lit alors un hôte
 * tronqué et échoue sur « Invalid URL ». Trente-neuf pour cent des tirages de
 * 24 octets contenaient un `/` — un déploiement sur trois échouait, au hasard,
 * sur une erreur qui ne désigne rien. `base64url` (A-Za-z0-9-_) traverse une URL
 * sans encodage, à entropie identique.
 */
const secret = (octets) => randomBytes(octets).toString('base64url');

/** Le sous-ensemble qui traverse une URL de connexion sans encodage. */
const traverseUneUrl = (valeur) => /^[A-Za-z0-9._~-]+$/.test(valeur);

const valeurDe = (contenu, variable) =>
  contenu.match(new RegExp(String.raw`^[ \t]*${variable}[ \t]*=[ \t]*(.+?)[ \t]*$`, 'm'))?.[1];

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

  /** Renseigne une variable déclarée vide par le modèle, sans jamais écraser. */
  function remplir(variable, valeur) {
    if (valeur === undefined || renseignee(contenu, variable)) return;
    contenu = contenu.replace(
      new RegExp(String.raw`^[ \t]*${variable}[ \t]*=.*$`, 'm'),
      `${variable}=${valeur}`,
    );
    remplies.push(variable);
  }

  remplir('POSTGRES_PASSWORD', secret(24));
  remplir('AUTH_SECRET', secret(36));

  // Un mot de passe écrit à la main, lui, peut venir d'un `openssl rand -base64`
  // et rapporter le problème que la génération vient d'éviter. Autant le dire
  // ici plutôt que de laisser le conteneur échouer sur « Invalid URL ».
  const motDePasse = valeurDe(contenu, 'POSTGRES_PASSWORD');
  if (motDePasse !== undefined && !traverseUneUrl(motDePasse)) {
    console.error(
      `\nPOSTGRES_PASSWORD contient un caractère que DATABASE_URL ne supporte pas.\n` +
        'Le mot de passe est injecté dans une URL de connexion ; `/` y termine\n' +
        "l'autorité, et le pilote échoue sur « Invalid URL ».\n\n" +
        `  openssl rand -hex 32   puis recopier dans ${nom}`,
    );
    process.exit(1);
  }
  // Seule variable que le script ne devine pas — il faut la lui donner.
  remplir('FRETLINE_DOMAIN', domaine);

  if (remplies.length > 0) writeFileSync(cible, contenu);

  if (creation) console.log(`${nom} créé depuis ${modele} — ${remplies.join(', ')}`);
  else if (remplies.length > 0) console.log(`${nom} complété : ${remplies.join(', ')}`);
  else console.log(`${nom} existe déjà — inchangé`);

  // Sortie en échec, et non un simple avertissement : `prod:up` enchaîne sur
  // `docker compose` avec `&&`. Un code 0 laissait la commande suivante
  // s'exécuter et échouer sur une erreur d'interpolation — le dernier message à
  // l'écran étant alors celui qui aide le moins.
  if (!renseignee(contenu, 'FRETLINE_DOMAIN')) {
    console.error(
      `\nIl reste FRETLINE_DOMAIN à renseigner dans ${nom}. Le donner ici :\n\n` +
        '  npm run prod:env -- --domain=:80           essai local, en clair, sans certificat\n' +
        '  npm run prod:env -- --domain=exemple.fr    domaine public — Caddy obtient le certificat\n\n' +
        '  puis : npm run prod:up',
    );
    process.exit(1);
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
