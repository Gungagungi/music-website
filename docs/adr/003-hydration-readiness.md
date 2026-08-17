# ADR-003 — Wait for an explicit readiness signal, not for a duration

**Status**: Accepted · **Date**: 2026-08 · **Scope**: application + test suite

## Context

Three tests were intermittently failing in CI and never locally: a cart quantity arriving as 1
instead of 2, a cart total read one render too early, a coupon form submitting an empty code. All
three passed on retry, so the pipeline was green and the summary called them flaky.

The trace settled it. At the moment of failure the coupon field was **empty** and the page showed
*"Les données envoyées sont invalides"* — the form had been submitted, with nothing in it.

The cause is hydration. Between the server-rendered HTML arriving and React finishing hydration,
a controlled input accepts typing but React's first render resets it to its state value, which is
still empty; event handlers are not attached yet either. Playwright is fast enough to land in that
window routinely under CI contention. A human on a slow connection can too.

Two fixes were tried and one of them was wrong, which is the useful part of this record:

1. **`fill()` then `expect(input).toHaveValue()`** — insufficient. The assertion retries the
   *read*, never the write, so once React has wiped the value it stays wiped.
2. **Re-fill until the value sticks** (`fillOnceHydrated`) — better, and still insufficient on its
   own. Confirming the value is a *snapshot*: hydration can land between the confirmation and the
   click that follows.

Neither `load` nor `domcontentloaded` helps. Both fire on server-rendered markup whose handlers
are not attached — they say the bytes arrived, not that the page is interactive.

## Decision

Have the application publish an explicit readiness signal, and wait on it.

`HydrationMarker` is a client component rendering nothing; it sets `data-hydrated="true"` on
`<html>` in its first effect. `BasePage.open()` waits for that attribute before returning, so no
page object hands control back to a spec while the page is still inert.

`fillOnceHydrated` is kept, for a different case: re-renders triggered mid-test by
`router.refresh()`, such as a cart line reloading from its API response.

## Consequences

**Good.** The three instabilities are gone — 263/263 with zero flakes in CI, where the same suite
previously flaked on two engines. More importantly the wait is on a fact rather than on a
duration: `waitForTimeout(500)` would have "worked" on the machine that wrote it and started
failing the day CI got busier, which is how suites accumulate ever-growing sleeps.

**Cost.** A test affordance in production code. It is one data attribute set by a component that
renders nothing, and it is arguably useful beyond testing as a genuine "interactive" signal — but
it is application code that exists for the suite, and that should be stated rather than hidden.

**Limit, worth being honest about.** This makes the *test* reliable, not the application. A real
user typing that early loses their input too. The proper product fix is to disable the control
until interactive, or make it uncontrolled; that is a product decision and is recorded here rather
than quietly papered over by the framework.
