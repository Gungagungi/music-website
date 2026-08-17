import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { loadEnv } from '@/db/load-env';
import * as schema from '@/db/schema';

/**
 * PostgreSQL connection pool.
 *
 * Pinned to `globalThis` for the same reason the in-memory store used to be (see
 * ADR-001, superseded by ADR-005): Next.js compiles route handlers into separate
 * module graphs and reloads modules in development. A plain module-level pool
 * would give each graph its own, and the server would exhaust `max_connections`
 * within a few hot reloads — a failure that surfaces far from its cause.
 *
 * Everything here is lazy. Importing this module must not require a database:
 * `next build` pulls it in through every route handler, and neither the build nor
 * the CI `qualite` job has a server to talk to.
 */

loadEnv();

const globalRef = globalThis as typeof globalThis & {
  __fretlinePool?: Pool;
  __fretlineDrizzle?: ReturnType<typeof createClient>;
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL est absent. Lancez `npm run db:up`, puis copiez .env.example vers .env.',
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalRef.__fretlinePool) {
    globalRef.__fretlinePool = new Pool({
      connectionString: connectionString(),
      // A single container does not need a large pool, and keeping it small makes
      // a connection leak show up as a timeout during the suite rather than
      // silently, much later, in production.
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalRef.__fretlinePool;
}

function createClient() {
  return drizzle(getPool(), { schema, casing: 'snake_case' });
}

function getClient() {
  if (!globalRef.__fretlineDrizzle) {
    globalRef.__fretlineDrizzle = createClient();
  }
  return globalRef.__fretlineDrizzle;
}

export type Db = ReturnType<typeof createClient>;

/**
 * The query interface, resolved on first use.
 *
 * A Proxy rather than a plain const so that merely importing `db` — which every
 * repository does — never opens a pool or reads DATABASE_URL. The alternative,
 * threading a `getDb()` call through every call site, buys nothing and reads worse.
 */
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});

/** Transaction handle — what `db.transaction(async (tx) => …)` hands its callback. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Accepts either the pool-backed client or an open transaction. */
export type DbOrTx = Db | Tx;

/** Closes the pool. For scripts and test teardown; the server keeps it open. */
export async function closePool(): Promise<void> {
  if (globalRef.__fretlinePool) {
    await globalRef.__fretlinePool.end();
    globalRef.__fretlinePool = undefined;
    globalRef.__fretlineDrizzle = undefined;
  }
}
