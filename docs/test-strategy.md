# Test strategy

Scope: **Fretline**, a fictional guitar and bass e-commerce site, and the automated suite that
exercises it. The site exists to give the suite something realistic to break — facets, sorting,
pagination, a cart with coupons, a checkout funnel, authentication. Every application design
decision was arbitrated by testability and determinism.

This document explains *why* the suite is shaped the way it is. The [test plan](test-plan.md)
covers what runs, when, and against what.

---

## 1. What we are protecting

Fretline is a shop. Ranked by what it costs to get wrong:

| Risk | Consequence if it ships | Where it is covered |
| --- | --- | --- |
| A wrong amount is charged | Direct financial loss, refunds, loss of trust | `REQ-CART-*`, `REQ-COUPON-*`, `REQ-API-21` |
| A customer sees or acts on another customer's data | Breach, legal exposure | `REQ-SEC-*` |
| The catalogue lies about what is in stock | Orders that cannot be honoured | `REQ-API-25`, `REQ-API-31`, `REQ-PDP-04` |
| The funnel breaks | No revenue at all | `REQ-ORDER-*` |
| Filtering or sorting returns the wrong set | Silent — the page looks fine | `REQ-CAT-*`, `REQ-SORT-*`, `REQ-PAGE-*` |
| The site is unusable with a keyboard or screen reader | Legal exposure, excluded customers | `REQ-A11Y-*` |
| A layout regression | Cosmetic, but erodes credibility | `REQ-VIS-*` |

The last two rows are the ones usually left out of a portfolio project. They are in scope here
precisely because leaving them out is the common failure.

**Money is the top risk, so money gets the most opinionated treatment.** Amounts are integer
cents end to end, in the application and in the tests. VAT is *extracted* from a
VAT-inclusive total, never added on top — the French retail convention. A test that computed
expected totals in floating point would agree with a buggy implementation roughly as often as
with a correct one, so `e2e/utils/money.ts` mirrors the application's arithmetic exactly and
`toShowPrice()` compares parsed cents rather than rendered strings.

## 2. Shape of the suite

```
        ╱ Visual (10) ╲          few, slow, environment-sensitive
      ╱  A11y (13)      ╲
    ╱   UI (88)           ╲      journeys, one engine deep + two shallow
  ╱     API (64)            ╲    contracts, edge cases, negatives — fast
```

This is deliberately **not** a classic pyramid, because the unit layer is not ours to own: the
application under test is a demonstration target, and the suite's job is to behave like an
external QA team with access to a browser and an HTTP client. Within that constraint the same
economics apply — push each check to the cheapest layer that can still catch the defect.

**The API layer carries the edge cases.** 64 API tests run in 10 seconds without launching a
browser. Every negative case, every contract check, every security assertion lives there. Driving
"a negative quantity is rejected" through a browser would cost sixty times more and prove less,
because the browser's own input validation would mask the server behaviour under test.

**The UI layer carries the journeys.** A UI test earns its place when the risk is in the wiring:
does the facet update the URL, does the URL survive pagination, does the cart badge follow the
cart. Chromium runs the full regression; Firefox and WebKit run `@smoke` only. That is not
laziness — those two have already paid for themselves by catching a hydration race and an
aborted navigation that Chromium never surfaced. But running 88 tests three times to find two
engine bugs a year is a bad trade; running the 36 riskiest is a good one.

**Contract testing is a first-class layer, not a footnote.** Every API response is validated
against a Zod schema declared `.strict()`. Strictness is the point: a permissive schema accepts a
response that leaked `passwordHash` alongside the expected fields. `REQ-SEC-14` exists because of
exactly that.

## 3. Test data

Two mechanisms, chosen per situation, because the usual single answer is wrong in one direction
or the other.

**Stable seeds for stable facts.** `e2e/data/seed.ts` mirrors the application's seed data and is
the contract between the two: known users, known coupons, and a handful of products picked for a
specific property (one out of stock, one cheap enough to sit below the free-shipping threshold,
one left-handed, one whose stock is only ever decremented by the stock-tracking test). A spec that
needs "a product that is out of stock" names `PRODUCTS.outOfStock` rather than hoping.

**Unique data for anything a test mutates.** Registration, orders and reviews build their own data
at runtime, so nothing collides under `fullyParallel`.

**The database is reset once per run, never per test.** This is the single most important data
decision in the project and it is counter-intuitive: the natural instinct is `beforeEach(reset)`.
That would be actively harmful here — the store is global to the server process, so a reset issued
from one worker would delete the data another worker is mid-way through using. Per-test isolation
is achieved by making the *data* unique, not by making the *database* empty.

The trade-off is real and worth stating: tests that consume finite resources (stock) can starve
later tests. The mitigation is explicit rather than accidental — `STOCK_TOP_UP` in the setup
project restocks the products the order specs consume, and every spec that asserts on a stock
level uses a product reserved for it and used by nothing else. The concurrency specs need that
guarantee most of all: two specs arranging the stock of the same item in parallel would read each
other's numbers, and the failure would look exactly like the race being hunted.

**The database is PostgreSQL, in the suite as much as in production.** The alternative — a fast
in-memory store for tests, a real database for the server — is tempting and wrong: it means the
suite never executes the code that runs on the server, and the bug you ship is by construction in
the half nobody tested. One code path costs the suite a Docker dependency, which
[ADR-005](adr/005-persistent-postgres.md) argues for and does not pretend is free.

What it buys is a class of test that did not previously exist. Overselling the last unit, a
checkout that decrements stock and then fails, two accounts on the same address — the defects an
e-commerce site is most likely to have and least likely to notice, because they fail rarely, under
load, and leave inconsistent data instead of an error message. `REQ-DATA-01` to `REQ-DATA-04`
cover them by racing two real requests against a real transaction.

**Retention is data policy, and it is tested.** Persisted carts accumulate, so they are deleted on
a schedule: 24 hours for an empty cart, 30 days for a guest cart with items, exempt for a cart
attached to an account, a year for a dormant one. A rule that runs at night and deletes rows is
exactly the kind nobody notices is wrong until the rows are gone. The specs age a real cart to
either side of each window and run the real purge, rather than reading the thresholds back — an
assertion derived from the same constant agrees with a broken policy as readily as with a correct
one. `REQ-DATA-13` is the one that carries the policy: the other windows would all pass against a
purge that simply deleted everything old enough.

## 4. Handling instability

A flaky test is treated as a defect with an owner, not as weather. The suite retries twice in CI,
which is a diagnostic aid, not a fix: **retries hide the symptom, so the summary reporter lists
flaky tests in their own section and CI keeps their traces** even when the job is green. A green
pipeline that quietly retried its way past a race is how a suite stops being believed.

Three instabilities were found and each turned out to be a real defect in the framework or the
application, never "just flakiness":

| Symptom | Actual cause |
| --- | --- |
| Cart total read the pre-update amount | `expect.extend` matchers do **not** inherit auto-retry; a single `innerText()` read raced the re-render |
| Coupon form submitted an empty code | Interaction landed before hydration; React's first render reset the controlled input |
| Cart quantity arrived as 1 instead of 2 | Same hydration race, different field |

The fixes were structural: matchers now poll through `toPass`, and the application publishes a
`data-hydrated` attribute that `BasePage.open()` waits on — an explicit readiness signal instead
of a duration guessed on the machine that wrote it. See [ADR-003](adr/003-hydration-readiness.md).

## 5. Entry and exit criteria

**Entry** — a change is ready to be tested when it builds, type-checks, lints, and the API suite
passes locally (10 seconds; there is no excuse).

**Exit** — a change is ready to merge when:

- every CI job is green, including `demo-defauts`, which is green *only if the suite still fails*
  on the deliberately bugged build;
- **zero flaky tests** in the merged report — a flake blocks the merge in the same way a failure
  does, because it is one;
- no new accessibility violation at serious or critical level;
- visual differences are either absent or explicitly reviewed and re-baselined;
- new specs carry `testCase()` and `covers()` annotations, and the generated traceability matrix
  is committed in the same change.

## 6. What is deliberately out of scope

Honest boundaries beat a coverage claim nobody believes:

- **No load testing of checkout.** It decrements real stock; a load test that empties the
  catalogue leaves the environment unusable for the suite that runs next. `perf/load.js` stops at
  the cart.
- **No cross-browser visual baselines.** Screenshots are captured on one engine. Multiplying them
  by three multiplies the maintenance cost and finds close to nothing.
- **No penetration testing.** The security suite covers authorisation, isolation and input
  handling — the things a functional QA team can assert. It does not pretend to be an audit.
- **No unit tests of application internals.** Out of the stated remit, and the API layer already
  covers the arithmetic that matters.
- **Accessibility is scanned, not certified.** axe-core catches roughly a third to a half of WCAG
  issues. The suite adds explicit keyboard-navigation and text-alternative checks on top, but
  passing it is not a conformance claim.

## 7. Deliberate defects

Three defects live in the codebase behind `SEED_BUGS=1`, off by default. They exist to answer the
question a green pipeline cannot: *would this suite actually catch anything?*

| ID | Defect | Why this one |
| --- | --- | --- |
| [BUG-001](bug-reports/BUG-001-coupon-rounding.md) | Percentage discount truncated to whole euros | Wrong by cents — invisible to a smoke test, expensive at scale |
| [BUG-002](bug-reports/BUG-002-sort-after-pagination.md) | Sort applied after pagination | Each page looks correctly sorted; the sequence is wrong |
| [BUG-003](bug-reports/BUG-003-missing-form-labels.md) | Form field with no associated label | The most common real-world a11y defect |

The `demo-defauts` CI job rebuilds with the defects enabled and **fails if the suite passes**.
That makes detection a genuine gate on coverage rather than a claim in a README.

---

## Related documents

- [Test plan](test-plan.md) — scope, environments, schedule, roles
- [Requirements](requirements.md) — the `REQ-*` catalogue
- [Traceability matrix](traceability-matrix.md) — generated, never hand-edited
- [Architecture decisions](adr/) — the four decisions that shaped the framework
