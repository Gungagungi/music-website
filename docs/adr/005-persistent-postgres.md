# ADR-005 — PostgreSQL, everywhere, including the suite

**Status**: Accepted · **Date**: 2026-08 · **Scope**: application under test, test data policy,
deployment · **Supersedes**: [ADR-001](001-in-memory-database.md)

## Context

[ADR-001](001-in-memory-database.md) chose an in-memory store and wrote down what it cost:

> Nothing here exercises transactions, isolation levels, or concurrent-write semantics, so a whole
> class of real defects is out of reach. That is a fair trade for a test-framework showcase; it
> would not be for a real shop.

Two things changed. The store was to be deployed for real, which an in-memory store cannot survive
— every order disappears when the process restarts. And the sentence above had started to look less
like a trade-off and more like a hole in what the suite could claim to cover. A QA framework whose
answer to "what happens when two customers buy the last guitar at the same time?" is "the
architecture makes that untestable" is answering a different question.

The defects that were out of reach are not exotic. They are the ones an e-commerce site is most
likely to have and least likely to notice: overselling the last unit, a checkout that decrements
stock and then fails, two accounts on the same address. They fail rarely, under load, and leave
inconsistent data rather than an error message.

## Options considered

1. **Keep the in-memory store, add persistence by writing snapshots to disk.** Cheap and preserves
   the fast reset, but persistence is the smaller half of the problem: snapshots buy durability and
   still leave no transactions, no isolation, no locking. It would have made the deployment work
   while leaving the coverage gap exactly where it was.

2. **PostgreSQL in production, in-memory in the suite.** The tempting one, because it keeps
   `npm test` free of Docker. It also means the suite never executes the code that runs on the
   server: two implementations of every query, two rounding paths, two definitions of what a
   concurrent checkout does. The bug you ship is by construction in the half nobody tested.

3. **PostgreSQL everywhere, reset by `TRUNCATE` and reseed.** One code path. The suite tests what
   is deployed, and the new class of defect becomes reachable — because it becomes possible.

## Decision

Option 3. PostgreSQL 17 through Drizzle ORM and the `pg` driver, in development, in CI, in the
suite and in production. `POST /api/test/reset` runs `TRUNCATE ... RESTART IDENTITY CASCADE`
followed by a reseed, in one transaction.

The principle that governed the migration was **reproduce the observable behaviour exactly, do not
improve it**. Every place where SQL would naturally do better than the JavaScript it replaced is a
place where a green spec turns red without any real regression existing. Two examples that were
deliberately not "fixed":

- Search stayed substring matching, on a `pg_trgm` index, rather than moving to `tsvector`. Full
  text search brings stemming and word boundaries, under which `strat mn` and `basse 5` stop
  matching. Better search is a change with its own requirements and its own test cases.
- Review aggregates are still updated incrementally rather than recomputed from the `reviews`
  table. The seeded `rating` and `review_count` describe a history the five seeded reviews do not
  contain; recomputing would overwrite them the first time anyone posted a review.

Both were verified rather than assumed: the catalogue query was compared against the original
JavaScript across 37 filter, sort and pagination combinations, in normal and `SEED_BUGS=1` mode,
before the old implementation was deleted.

## Consequences

**The cost, stated plainly.** `npm test` now needs Docker. ADR-001 identified "no service, no
Docker, no compiler toolchain" as *the single biggest factor in whether anyone actually runs the
suite*, and that is exactly what has been given up. Setup went from two commands to three
(`npm run db:setup`), and a machine with no container runtime can no longer run the suite at all.
This is the real price, and it is not softened by the fact that it bought something valuable.

**What it bought.** Ten test cases that could not previously exist —
[`REQ-DATA-01`](../requirements.md) through `REQ-DATA-14`: the last-unit race, the stock floor,
checkout atomicity in both directions (no partial decrement, no partial order), the duplicate
registration race, and the four cart retention windows. Plus `REQ-DATA-05`, persistence across a
restart, verified against the deployed stack because Playwright cannot restart the server it is
talking to.

**A reset that is no longer free.** It went from O(1) to about 370 ms, of which roughly 280 ms was
three scrypt hashes until those were memoised per process; it now settles near 90 ms after the
first call. Still fast enough for the once-per-run policy of [ADR-002](002-test-data-isolation.md),
which is unchanged and now has a second reason to exist: a reset from one worker would truncate
tables another worker is using.

**Carts became rows, and rows accumulate.** An in-memory cart vanished with the process. A
persisted one does not, so the store needed a retention policy it never needed before — and the
policy is itself now covered, which most shops' never is. See `app/src/lib/retention.ts`.

**A production surface that has to be guarded.** `/api/test/*` truncates the database, and it now
truncates a database that matters. Three layers hold it shut: no test-mode variable in the
production compose, a warning at startup, and `scripts/verifier-deploiement.sh` proving after the
fact that the routes answer 404. `AUTH_SECRET` became mandatory outside development.

## What is still not covered

`ON DELETE RESTRICT` on `order_items → products` is a real constraint with no code path: the
application has no way to delete a product, so a black-box suite has no way to reach it. Testing it
would mean either giving the e2e suite a SQL connection — abandoning the property that it speaks
only HTTP — or inventing a delete-product endpoint that exists solely to be tested. Neither is
worth it. The constraint is documented here instead, which is the honest place for a guarantee that
is asserted by the schema and nothing else.
