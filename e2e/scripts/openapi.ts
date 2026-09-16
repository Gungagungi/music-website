#!/usr/bin/env node
/**
 * Produces `docs/api/openapi.json` from the contract schemas.
 *
 *   npx tsx scripts/openapi.ts           # regenerates
 *   npx tsx scripts/openapi.ts --check   # fails if the committed file diverges
 *
 * Same rule as the traceability matrix: the artefact is generated, committed,
 * and checked in CI. A document that describes an API and that nothing ever
 * confronts with that API ends up describing the API of six months ago — and it
 * is then worse than missing, since people keep relying on it.
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
 * OpenAPI 3.1 is a superset of JSON Schema 2020-12, so converting from Zod is
 * direct. The `$schema` Zod adds, however, has no business in an OpenAPI
 * document, which already carries its own version.
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
      'Generated from the contract schemas the API suite validates on every run ' +
      '(`e2e/api/schemas.ts`). Do not edit by hand: `npm run openapi:check -w e2e` ' +
      'fails if the committed file diverges from the code.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Development and test suite' }],
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
 * The spec is validated before being written or compared.
 *
 * A Zod → JSON Schema conversion can produce a document that is syntactically
 * correct yet invalid in the OpenAPI sense — an unknown `format`, a combination
 * of keywords 3.1 rejects. Publishing that document means handing readers a file
 * their tools will reject, which no shape test on our own schemas would reveal.
 */
async function principal(): Promise<void> {
  const rapport = await validate(JSON.parse(rendu));
  if (!rapport.valid) {
    console.error('The generated specification is not a valid OpenAPI document:');
    console.error(rapport.errors ?? rapport);
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    let committe: string;
    try {
      committe = readFileSync(CIBLE, 'utf8');
    } catch {
      console.error(`${CIBLE} is missing. Run \`npm run openapi -w e2e\`.`);
      process.exit(1);
    }
    if (committe !== rendu) {
      console.error(
        'The committed specification diverges from the contract schemas.\n' +
          'Run `npm run openapi -w e2e` and commit the result.',
      );
      process.exit(1);
    }
    console.log(`Specification up to date and valid: ${OPERATIONS.length} operations.`);
    return;
  }

  mkdirSync(dirname(CIBLE), { recursive: true });
  writeFileSync(CIBLE, rendu);
  console.log(`${OPERATIONS.length} operations written to ${CIBLE}`);
}

// No top-level `await`: `e2e` is compiled as CommonJS, where esbuild rejects it.
// The rejection is propagated by hand, otherwise the script would exit with 0
// after reporting an invalid spec.
principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
