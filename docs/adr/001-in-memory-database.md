# ADR-001 — An in-memory store, resettable in O(1)

**Status**: Superseded by [ADR-005](005-persistent-postgres.md) · **Date**: 2026-08 · **Scope**:
application under test

> **Superseded.** The store now runs on PostgreSQL, in the suite as well as in production —
> [ADR-005](005-persistent-postgres.md). This record is kept because the paragraph it ends on is
> the reason: the cost written down here as acceptable is precisely the one that was later judged
> too high, and ADR-005 is that argument continued rather than reversed.

## Context

The suite needs a known starting state and needs to get back to it quickly and reliably. The
application is a test target, so its persistence layer is chosen for what it does to the suite,
not for production realism.

Options considered:

1. **PostgreSQL in a container** — realistic, but adds a service to start before any test runs,
   makes the suite depend on Docker being available, and makes "reset" a migration-and-truncate
   dance measured in seconds.
2. **SQLite via `better-sqlite3`** — no service, but a native module: it has to compile on every
   machine and in every CI image, and the Playwright container is not a build environment.
3. **An in-memory store seeded from JSON** — no service, no native code, reset is a re-clone of
   the seed objects.

## Decision

Option 3. A single object pinned to `globalThis.__fretlineDb`, rebuilt from the seed data by
`resetDb()`.

Pinning to `globalThis` is not decoration: Next.js compiles route handlers separately and reloads
modules in development, so a plain module-level variable would give different handlers different
copies of the database. That failure mode is silent and looks exactly like a race condition.

Products are deep-cloned from the seed. Stock decrements on checkout must never reach the seed, or
the "reset" would restore an already-consumed catalogue and the suite would slowly poison itself.

## Consequences

**Good.** `POST /api/test/reset` is effectively instantaneous, which is what makes a per-run reset
practical. `git clone && npm install && npm test` works with no service, no Docker, no compiler
toolchain — the single biggest factor in whether anyone actually runs the suite.

**Bad, and accepted.** State is global to the server process, which is exactly why the database
can only be reset once per run — see [ADR-002](002-test-data-isolation.md). Nothing here exercises
transactions, isolation levels, or concurrent-write semantics, so a whole class of real defects is
out of reach. That is a fair trade for a test-framework showcase; it would not be for a real shop.
