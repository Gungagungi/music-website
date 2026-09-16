/**
 * Creates an environment file if it does not exist, drawing the values that are
 * secrets at random.
 *
 *   node scripts/preparer-env.mjs               → .env, from .env.example
 *   node scripts/preparer-env.mjs --production  → .env.production, from .env.production.example
 *   ... --production --domain=:80               → also sets FRETLINE_DOMAIN
 *   node scripts/preparer-env.mjs --preprod     → .env.preprod, from .env.preprod.example
 *
 * Nothing is ever overwritten: a variable that already has a value is left as
 * it is, however many times the script runs.
 *
 * Randomness is the point: a signing key in clear text in an example file would
 * one day be copied onto a server, and nobody would notice — that is exactly
 * the hole the guard in lib/deployment.ts tries to prevent. One value per
 * machine, never versioned, closes that door at no cost.
 *
 * Node rather than `openssl`: it is the only dependency we can be sure of.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const preprod = process.argv.includes('--preprod');
const domaine = process.argv.find((argument) => argument.startsWith('--domain='))?.slice(9);

const nom = production ? '.env.production' : preprod ? '.env.preprod' : '.env';
const modele = `${nom}.example`;
const cible = join(repoRoot, nom);

/**
 * `base64url`, not `base64`.
 *
 * POSTGRES_PASSWORD ends up in DATABASE_URL, and the base64 alphabet contains
 * `/`, which ends a URL's authority section: the driver then reads a truncated
 * host and fails with "Invalid URL". Thirty-nine percent of 24-byte draws
 * contained a `/` — one deployment in three failed, at random, on an error that
 * points at nothing. `base64url` (A-Za-z0-9-_) goes through a URL without
 * encoding, with identical entropy.
 */
const secret = (octets) => randomBytes(octets).toString('base64url');

/** The subset that goes through a connection URL without encoding. */
const traverseUneUrl = (valeur) => /^[A-Za-z0-9._~-]+$/.test(valeur);

const valeurDe = (contenu, variable) =>
  contenu.match(new RegExp(String.raw`^[ \t]*${variable}[ \t]*=[ \t]*(.+?)[ \t]*$`, 'm'))?.[1];

/**
 * True if the variable is present AND has a value.
 *
 * Spaces and tabs, not `\s`: `\s` covers the newline, so `VARIABLE=` followed by
 * any line looked set — the value found was the first character of the next
 * line.
 */
const renseignee = (contenu, variable) =>
  new RegExp(String.raw`^[ \t]*${variable}[ \t]*=[ \t]*\S`, 'm').test(contenu);

const creation = !existsSync(cible);
if (creation) {
  copyFileSync(join(repoRoot, modele), cible);
  // `copyFileSync` keeps the template's permissions, versioned and therefore
  // world-readable (664): the secrets file was readable too, by the whole group.
  chmodSync(cible, 0o600);
}

let contenu = readFileSync(cible, 'utf8');

// The production and pre-production templates declare the variables without a
// value, so that compose refuses to start until they are filled in. Those that
// are pure secrets have no reason to ask for a human decision: they are filled
// in here. FRETLINE_DOMAIN does.
const remplies = [];

/** Sets a variable the template declares empty, never overwriting. */
function remplir(variable, valeur) {
  if (valeur === undefined || renseignee(contenu, variable)) return;
  const declaration = new RegExp(String.raw`^[ \t]*${variable}[ \t]*=.*$`, 'm');
  // A variable added later is not declared by files created before it: without
  // this append, the replacement would find nothing, the script would exit
  // silently, and compose would fail further on with a missing interpolation —
  // an error that does not point at the file to fix.
  contenu = declaration.test(contenu)
    ? contenu.replace(declaration, `${variable}=${valeur}`)
    : `${contenu}\n${variable}=${valeur}\n`;
  remplies.push(variable);
}

/**
 * A password written by hand, however, may come from `openssl rand -base64`
 * and bring back the very problem generation just avoided. Better to say so
 * here than to let the container fail with "Invalid URL".
 */
function exigerMotDePasseCompatibleUrl() {
  const motDePasse = valeurDe(contenu, 'POSTGRES_PASSWORD');
  if (motDePasse !== undefined && !traverseUneUrl(motDePasse)) {
    console.error(
      `\nPOSTGRES_PASSWORD contains a character DATABASE_URL does not support.\n` +
        'The password is injected into a connection URL; `/` ends the authority\n' +
        'there, and the driver fails with "Invalid URL".\n\n' +
        `  openssl rand -hex 32   then copy it into ${nom}`,
    );
    process.exit(1);
  }
}

function ecrireEtRapporter() {
  if (remplies.length > 0) writeFileSync(cible, contenu);

  if (creation) console.log(`${nom} created from ${modele} — ${remplies.join(', ')}`);
  else if (remplies.length > 0) console.log(`${nom} completed: ${remplies.join(', ')}`);
  else console.log(`${nom} already exists — unchanged`);
}

if (production) {
  remplir('POSTGRES_PASSWORD', secret(24));
  remplir('AUTH_SECRET', secret(36));
  // Same reason as POSTGRES_PASSWORD: the value goes through a connection
  // string. It calls for no human decision either.
  remplir('MATOMO_DB_PASSWORD', secret(24));
  exigerMotDePasseCompatibleUrl();
  // The only variable the script cannot guess — it has to be given.
  remplir('FRETLINE_DOMAIN', domaine);

  ecrireEtRapporter();

  // Exit with a failure, not a mere warning: `prod:up` chains into
  // `docker compose` with `&&`. An exit code of 0 let the next command run and
  // fail on an interpolation error — the last message on screen then being the
  // least helpful one.
  if (!renseignee(contenu, 'FRETLINE_DOMAIN')) {
    console.error(
      `\nFRETLINE_DOMAIN still needs to be set in ${nom}. Pass it here:\n\n` +
        '  npm run prod:env -- --domain=:80           local trial, plain HTTP, no certificate\n' +
        '  npm run prod:env -- --domain=example.com   public domain — Caddy obtains the certificate\n\n' +
        '  then: npm run prod:up',
    );
    process.exit(1);
  }
} else if (preprod) {
  // Nothing to decide here: the pre-production domain and access are carried by
  // the production Caddy, hence by .env.production.
  remplir('POSTGRES_PASSWORD', secret(24));
  remplir('AUTH_SECRET', secret(36));
  remplir('TEST_API_TOKEN', secret(24));
  exigerMotDePasseCompatibleUrl();

  ecrireEtRapporter();
} else {
  // An existing `.env` is left as it is, with one exception: the signing key.
  // It was added later, so files created before this script lack it — and
  // `npm start` would refuse to start without it, with an error that helps
  // nobody understand that a local file is out of date.
  const aUneCle = renseignee(contenu, 'AUTH_SECRET');

  if (!aUneCle) {
    appendFileSync(
      cible,
      `\n# Generated when this file was created, specific to this machine.\nAUTH_SECRET=${secret(36)}\n`,
    );
  }

  if (creation) console.log('.env created from .env.example, with a randomly drawn AUTH_SECRET');
  else if (!aUneCle) console.log('.env completed: randomly drawn AUTH_SECRET added');
  else console.log('.env already exists — unchanged');
}
