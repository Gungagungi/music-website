# ADR-002 — Reset once per run, isolate by uniqueness

**Status**: Accepted · **Date**: 2026-08 · **Scope**: test suite

## Context

Tests run with `fullyParallel` across several workers. Each needs a predictable starting state
without seeing the others' data.

The reflex answer is `beforeEach(() => resetDatabase())`. It is wrong here, and dangerously so:
the store is global to the server process ([ADR-001](001-in-memory-database.md)), so a reset
issued by worker 2 deletes the cart worker 1 is halfway through checking out. The resulting
failures are non-deterministic, land on whichever test was unlucky, and point nowhere near the
cause. This is the kind of design mistake that gets diagnosed as "Playwright is flaky".

## Decision

Reset **once per run**, in a dedicated `setup-db` project every other project depends on. Achieve
per-test isolation by making the *data* unique rather than the *database* empty:

- `registeredUser` builds an account with an address unique to the worker and the timestamp
- `cartWith` arranges a cart through the API, then hands the identifier to the browser
- builders and faker produce anything a test creates
- `e2e/data/seed.ts` names the fixed data a test only ever reads — a product that is out of stock,
  one below the free-shipping threshold, a left-handed one

Dependencies between projects (`setup-db` → `setup-auth` → everything else) mean no spec can ever
race the reset.

## Consequences

**Good.** Parallelism is safe, and the suite runs in a fraction of the time a serialised one
would. Reads of stable data stay expressive: `PRODUCTS.outOfStock` says what the test needs
instead of hoping some product happens to be unavailable.

**Bad, and mitigated explicitly.** Tests that consume a finite resource can starve later tests.
Order specs decrement real stock, and a full run once produced 25 `OUT_OF_STOCK` failures in the
projects that happened to run last — a failure that looks like a product bug and is not. The
mitigation is `STOCK_TOP_UP` in the setup project, plus a product reserved for the
stock-decrement assertion so nothing else touches it.

The general shape of the rule: **anything a test mutates must be unique to it; anything shared
must be read-only.** Where that is impossible — stock — the top-up is stated in one place rather
than worked around test by test.
