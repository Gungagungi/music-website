/**
 * Crée le `.env` de développement s'il n'existe pas.
 *
 * Copie `.env.example`, puis y ajoute une AUTH_SECRET tirée au hasard. Le hasard
 * est le point : une clé de signature en clair dans `.env.example` finirait un
 * jour recopiée sur un serveur, et personne ne s'en apercevrait — c'est
 * exactement la faille que la garde de lib/deployment.ts cherche à empêcher. Une
 * clé par poste, jamais versionnée, ferme cette porte sans rien coûter.
 *
 * Node plutôt qu'`openssl` : c'est la seule dépendance dont on soit certain.
 *
 * Usage : node scripts/preparer-env.mjs
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cible = join(repoRoot, '.env');

const creation = !existsSync(cible);
if (creation) copyFileSync(join(repoRoot, '.env.example'), cible);

// Un `.env` existant est laissé tel quel, à une exception près : la clé de
// signature. Elle est arrivée après coup, donc les fichiers créés avant ce
// script n'en ont pas — et `npm start` refuserait de démarrer sans, avec une
// erreur qui n'aide personne à comprendre qu'un fichier local est en retard.
const aUneCle = /^\s*AUTH_SECRET\s*=\s*\S/m.test(readFileSync(cible, 'utf8'));

if (!aUneCle) {
  appendFileSync(
    cible,
    `\n# Générée à la création de ce fichier, propre à ce poste.\nAUTH_SECRET=${randomBytes(36).toString('base64')}\n`,
  );
}

if (creation) console.log('.env créé depuis .env.example, avec une AUTH_SECRET tirée au hasard');
else if (!aUneCle) console.log('.env complété : AUTH_SECRET tirée au hasard ajoutée');
else console.log('.env existe déjà — inchangé');
