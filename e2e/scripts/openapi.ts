#!/usr/bin/env node
/**
 * Produit `docs/api/openapi.json` depuis les schémas de contrat.
 *
 *   npx tsx scripts/openapi.ts           # régénère
 *   npx tsx scripts/openapi.ts --check   # échoue si le fichier committé diverge
 *
 * Même règle que la matrice de traçabilité : l'artefact est généré, committé, et
 * vérifié en CI. Un document qui décrit une API et que rien ne confronte à cette
 * API finit par décrire l'API d'il y a six mois — et il est alors pire
 * qu'absent, puisqu'on continue de s'y fier.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '@readme/openapi-parser';
import { z } from 'zod';

import { OPERATIONS } from '../api/openapi';
import type { Operation } from '../api/openapi';

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CIBLE = resolve(E2E_DIR, '..', 'docs', 'api', 'openapi.json');

/**
 * OpenAPI 3.1 est un sur-ensemble de JSON Schema 2020-12, donc la conversion de
 * Zod est directe. Le `$schema` que Zod ajoute n'a en revanche rien à faire dans
 * un document OpenAPI, qui porte déjà sa propre version.
 */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...reste } = z.toJSONSchema(schema, { io: 'output' }) as Record<string, unknown>;
  void $schema;
  return reste;
}

function corpsDe(operation: Operation) {
  if (!operation.corps) return undefined;
  return {
    required: true,
    content: { 'application/json': { schema: jsonSchema(operation.corps) } },
  };
}

function reponsesDe(operation: Operation) {
  return Object.fromEntries(
    operation.reponses.map((reponse) => [
      String(reponse.code),
      {
        description: reponse.description,
        ...(reponse.schema
          ? { content: { 'application/json': { schema: jsonSchema(reponse.schema) } } }
          : {}),
      },
    ]),
  );
}

function parametresDe(operation: Operation) {
  if (!operation.parametres || operation.parametres.length === 0) return undefined;
  return operation.parametres.map((parametre) => ({
    name: parametre.nom,
    in: parametre.dans,
    required: parametre.dans === 'path',
    description: parametre.description,
    schema: jsonSchema(parametre.schema),
  }));
}

const SECURITE = {
  'cookie-ou-bearer': [{ porteurCookie: [] }, { porteurBearer: [] }],
  panier: [{ panierCookie: [] }, { panierEntete: [] }],
} as const;

const paths: Record<string, Record<string, unknown>> = {};
for (const operation of OPERATIONS) {
  const chemin = (paths[operation.chemin] ??= {});
  chemin[operation.methode] = {
    summary: operation.resume,
    tags: [operation.etiquette],
    ...(operation.authentification ? { security: SECURITE[operation.authentification] } : {}),
    ...(parametresDe(operation) ? { parameters: parametresDe(operation) } : {}),
    ...(corpsDe(operation) ? { requestBody: corpsDe(operation) } : {}),
    responses: reponsesDe(operation),
  };
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Fretline — API',
    version: '1.0.0',
    description:
      'Généré depuis les schémas de contrat que la suite d’API valide à chaque run ' +
      '(`e2e/api/schemas.ts`). Ne pas éditer à la main : `npm run openapi:check -w e2e` ' +
      'échoue si le fichier committé diverge du code.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Développement et suite de tests' }],
  tags: [...new Set(OPERATIONS.map((operation) => operation.etiquette))].map((name) => ({ name })),
  components: {
    securitySchemes: {
      porteurCookie: { type: 'apiKey', in: 'cookie', name: 'fretline_token' },
      porteurBearer: { type: 'http', scheme: 'bearer' },
      panierCookie: { type: 'apiKey', in: 'cookie', name: 'fretline_cart' },
      panierEntete: { type: 'apiKey', in: 'header', name: 'x-cart-id' },
    },
  },
  paths,
};

const rendu = `${JSON.stringify(document, null, 2)}\n`;

/**
 * La spec est validée avant d'être écrite ou comparée.
 *
 * Une conversion Zod → JSON Schema peut produire un document syntaxiquement
 * correct et invalide au sens d'OpenAPI — un `format` inconnu, une combinaison
 * de mots-clés que la 3.1 refuse. Publier ce document-là, c'est offrir aux
 * lecteurs un fichier que leurs outils rejetteront, ce qu'aucun test de forme
 * sur nos propres schémas ne dirait.
 */
async function principal(): Promise<void> {
  const rapport = await validate(JSON.parse(rendu));
  if (!rapport.valid) {
    console.error('La spécification produite n’est pas un document OpenAPI valide :');
    console.error(rapport.errors ?? rapport);
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    let committe: string;
    try {
      committe = readFileSync(CIBLE, 'utf8');
    } catch {
      console.error(`${CIBLE} est absent. Lancer \`npm run openapi -w e2e\`.`);
      process.exit(1);
    }
    if (committe !== rendu) {
      console.error(
        'La spécification committée diverge des schémas de contrat.\n' +
          'Lancer `npm run openapi -w e2e` et committer le résultat.',
      );
      process.exit(1);
    }
    console.log(`Spécification à jour et valide : ${OPERATIONS.length} opérations.`);
    return;
  }

  mkdirSync(dirname(CIBLE), { recursive: true });
  writeFileSync(CIBLE, rendu);
  console.log(`${OPERATIONS.length} opérations écrites dans ${CIBLE}`);
}

// Pas d'`await` de premier niveau : `e2e` est compilé en CommonJS, où esbuild le
// refuse. Le rejet est propagé à la main, sans quoi le script sortirait en 0
// après avoir signalé une spec invalide.
principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
