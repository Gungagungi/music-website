# Fretline — QA automation portfolio

[![CI](https://github.com/Gungagungi/music-website/actions/workflows/ci.yml/badge.svg)](https://github.com/Gungagungi/music-website/actions/workflows/ci.yml)
[![Nightly](https://github.com/Gungagungi/music-website/actions/workflows/nightly.yml/badge.svg)](https://github.com/Gungagungi/music-website/actions/workflows/nightly.yml)

A fictional guitar and bass shop, and the test framework that holds it to account.

The shop is not the point. It exists to give the suite something realistic to break — faceted
search, sorting across pagination, a cart with coupons and VAT, a three-step checkout,
authentication, stock that actually runs out. Every application design decision was arbitrated by
testability and determinism — including the one to put it on a real PostgreSQL, because two
checkouts racing for the last unit in stock is not a defect an in-memory store can have.

**185 automated test cases · 139 requirements · 0 untraced · 0 flaky.**

---

## Contents

- [What is covered](#what-is-covered)
- [Stack](#stack)
- [Architecture](#architecture)
- [Running it](#running-it)
- [Framework design](#framework-design)
- [Test data](#test-data)
- [Reporting](#reporting)
- [Continuous integration](#continuous-integration)
- [Does any of it catch anything?](#does-any-of-it-catch-anything)
- [Three problems worth reading about](#three-problems-worth-reading-about)
- [Documentation](#documentation)
- [Known limitations](#known-limitations)

---

## What is covered

| Suite | Cases | Runtime | Scope |
| --- | ---: | ---: | --- |
| **API** | 74 | ~15 s | Every endpoint, response contracts validated with strict Zod schemas, error codes, pagination, negatives, security — the same schemas generate [the OpenAPI spec](docs/api/openapi.json) |
| **UI** | 88 | ~5 min | Catalogue and facets, sorting, pagination, search, product page, cart, coupons, checkout, authentication, comparator |
| **Accessibility** | 13 | ~1 min 30 | axe-core WCAG 2.1 A/AA across 8 pages and the checkout funnel, skip link, keyboard-only journey, text alternatives |
| **Visual** | 10 | ~40 s | Component baselines captured in the CI container |
| **Performance** | 2 scripts | 30 s / 4 min | k6 smoke on every PR, load test nightly |
| **Unit** | 47 | ~2 s | Monetary arithmetic — rounding, VAT extraction, shipping thresholds, coupon rules |

Tags: `@smoke` 42 · `@regression` 134 · `@critical` 61 · `@contract` 21 · `@security` 19 ·
`@known-bug` 3.

Browsers: Chromium carries the full regression across three shards; Firefox and WebKit run
`@smoke` only; mobile Chrome covers the responsive viewport. That split is not laziness — Firefox
and WebKit have each already caught an engine-specific defect the others never surfaced. But
running 88 tests three times to find two bugs a year is a bad trade.

## Stack

| | |
| --- | --- |
| **Test framework** | Playwright 1.62 (TypeScript) — UI, API, accessibility, visual |
| **Application under test** | Next.js 16 (App Router), React 19, Tailwind 4, TypeScript |
| **Contract validation** | Zod 4, every response schema `.strict()` |
| **Accessibility** | axe-core via `@axe-core/playwright` |
| **Performance** | k6 |
| **CI** | GitHub Actions — sharding, containers, blob-report merging |

TypeScript on both sides on purpose: one toolchain, one linter, one type-checker, and the test
suite can import the application's own money helpers rather than reimplementing them slightly
differently.

## Architecture

```
music-website/
├── app/                    # System under test — Next.js + REST API
│   ├── src/lib/            # money.ts, cart.ts, catalog.ts, auth.ts, api.ts
│   ├── src/lib/repositories/  # every SQL query, one module per aggregate
│   ├── src/db/             # Drizzle schema, migrations, seed, CLI commands
│   ├── src/app/api/        # REST endpoints + guarded test hooks
│   └── src/data/           # 73 products, 9 categories, deterministic seed
├── e2e/                    # The framework
│   ├── playwright.config.ts
│   ├── fixtures/           # Typed fixtures — POMs, API clients, auth, cart arrangement
│   ├── pages/              # Page objects — locators and actions, no assertions
│   ├── api/                # Typed API client + strict Zod schemas
│   ├── data/               # Seed mirror + builders
│   ├── utils/              # Custom matchers, money parsing, a11y helpers
│   ├── reporters/          # Markdown summary → GitHub job summary
│   ├── scripts/            # Traceability generator
│   └── tests/              # ui/ api/ a11y/ visual/
├── perf/                   # k6 — smoke.js, load.js
├── scripts/                # backups, post-deployment checks
├── docs/                   # QA documentation
└── .github/workflows/      # ci · nightly · visual baselines · pages
```

## Running it

```bash
git clone https://github.com/Gungagungi/music-website.git
cd music-website
npm install
npx playwright install --with-deps chromium

npm run db:setup   # .env, PostgreSQL in Docker, migrations, seed data
npm run build      # required — the suite serves the production build
npm test           # everything
```

`db:setup` is the line that used to not exist. The store kept everything in memory, and the
suite ran with no service, no Docker and no `.env` — which was the single biggest factor in
whether anyone actually ran it. That is now traded for transactional semantics: a whole class
of defect, starting with two checkouts racing for the last unit in stock, cannot be reached
from an in-memory store at all. It is a real cost, and it is stated rather than glossed over.

Everything else about the local run is unchanged, including `npm run test:api` finishing in
about ten seconds.

### Targeted runs

```bash
npm run test:api            # 74 API tests, ~15 s, no browser
npm run test:unit           # 47 unit tests on the pricing arithmetic, ~2 s, no database
npm run test:mutation       # Stryker on money.ts and cart.ts pricing, ~45 s
npm run test:smoke          # the @smoke set
npm run test:ui             # UI on Chromium
npm run test:a11y           # accessibility scans
npm run report              # open the HTML report
npm run perf:smoke          # k6 (k6 must be installed)

cd e2e
npx playwright test tests/ui/panier.spec.ts --project=chromium
npx playwright test --project=chromium -g "modifier la quantité" --headed
npx playwright test --project=chromium --debug
```

> **`npm run test:visual` fails on a workstation. That is expected.** Baselines belong to the CI
> container — see [ADR-004](docs/adr/004-visual-baselines.md).

## Framework design

**Page objects expose locators and actions, never assertions.** Expectations stay in the specs.
The alternative grows one method per assertion and produces failure messages that point three
files away from the test's intent.

**Fixtures compose the arrangement.** `cartWith([{ sku, quantity }])` arranges a cart through the
API and hands it to the browser; `registeredUser` builds an account unique to the worker;
`signInAs` reuses a stored session. A checkout spec spends its first line arranging and the rest
verifying.

**Domain matchers state the business fact.**

```ts
await expect(cartPage.discount).toShowPrice(-826);
await expect(catalogPage.prices).toBeSortedByPrice('asc');
```

The alternative — read the text, strip four kinds of Unicode space, parse a French decimal,
compare — states the plumbing and buries the intent underneath it. Both matchers poll through
`toPass`, because **`expect.extend` matchers do not inherit the auto-retry of built-in
assertions** — a fact that cost two flaky tests to learn.

**Money is integer cents everywhere.** VAT is extracted from a VAT-inclusive total, never added on
top. A test that computed expected totals in floating point would agree with a buggy
implementation about as often as with a correct one.

**Every API response is validated against a `.strict()` schema.** Strictness is the point: a
permissive schema happily accepts a response that leaked `passwordHash` alongside the fields you
asked for.

**Traceability is generated, not maintained.** Specs declare `testCase('TC-110', …)` and
`covers('REQ-COUPON-01')`; a script derives the matrix and the CSV, and CI fails if the committed
copies drift. It also rejects duplicate identifiers — which is how `TC-271` was found covering
three distinct coupon-rejection scenarios at once.

It checks **both directions**, and each caught something the other could not. A requirement nobody
wrote a spec for used to be indistinguishable from a covered one, because a requirement nothing
points at simply never appeared in the matrix. And a typo in `covers()` produced a confident row
for a requirement that does not exist. A requirement deliberately verified outside the suite says
so in its own line — `REQ-DATA-05` needs the server restarted, which Playwright cannot do to the
server it is talking to.

## Test data

**The database is reset once per run, never per test.** This is the most counter-intuitive
decision in the project and the most important. The store is global to the server process, so a
`beforeEach(reset)` issued by one worker would delete the cart another worker is halfway through
checking out — producing non-deterministic failures that land on whichever test was unlucky and
point nowhere near the cause. This is the kind of design mistake that gets diagnosed as
"Playwright is flaky".

Isolation comes from making the **data** unique instead of the **database** empty:

| Kind | Mechanism |
| --- | --- |
| Stable facts a test only reads | `e2e/data/seed.ts` — `PRODUCTS.outOfStock`, `COUPONS.expired`, `RULES.freeShippingThresholdCents` |
| Anything a test creates | Builders + faker, unique per worker and timestamp |
| Finite resources (stock) | `STOCK_TOP_UP` in the setup project, plus a product reserved for the stock-decrement assertion |

That last row is the honest part: order specs consume real stock, and a full run once produced 25
`OUT_OF_STOCK` failures in whichever projects happened to run last — a failure that looks like a
product bug and is not. The mitigation is stated in one place rather than worked around test by
test. See [ADR-002](docs/adr/002-test-data-isolation.md).

**The store runs on PostgreSQL, in the suite as well as in production.** One code path, so the
suite exercises what is deployed — and a class of defect that an in-memory store cannot have
becomes testable: two checkouts racing for the last unit, a payment that fails halfway, two
accounts registering the same address at the same instant. That is what
[ADR-005](docs/adr/005-persistent-postgres.md) bought, and what it cost is stated there too:
`npm test` now needs Docker, which ADR-001 had called the single biggest factor in whether anyone
runs a suite at all.

Test hooks (`/api/test/reset`, `/seed`, `/state`, `/purge`) are doubly guarded: invisible without
`E2E_TEST_MODE=1`, then refused without a valid `x-test-token`. `REQ-SEC-12` asserts the guard,
because a test hook reachable in production is a vulnerability, not a convenience — and it now
truncates a database that matters. A third layer checks it from outside after every deployment,
including in CI: `scripts/verifier-deploiement.sh`.

## Reporting

| Artefact | Where |
| --- | --- |
| Merged HTML report — all shards and projects in one | `rapport-playwright` artifact, 30 days |
| Markdown summary — per project, failures **and flakes** | GitHub job summary |
| Traces — failures **and flakes** | `traces-*` artifacts, 7 days |
| Visual diffs | `diffs-visuels` artifact |
| k6 results (JSON + Markdown) | `perf-*` artifacts |
| JUnit XML | `e2e/reports/junit.xml` |

Two choices worth explaining.

**Flaky tests get their own section in the summary.** A green pipeline that quietly retried its
way past a race is how a suite stops being believed. Naming them keeps the debt visible.

**Traces are kept for flaky tests too**, not just failures. A test that passes on retry is
precisely the one that will not reproduce locally, so its trace is the only evidence there is.
This was learned the hard way: diagnosing the hydration race meant extracting an error context
from the internals of a blob report, because the job was green and the upload was gated on
`if: failure()`.

## Continuous integration

**`ci.yml`** — every push and pull request, ~6 minutes wall clock:

| Job | Content |
| --- | --- |
| `qualite` | ESLint, `tsc --noEmit`, 47 unit tests, production build — **published as an artifact** |
| `mutation` | Stryker on the pricing arithmetic, **breaks below 100 %** |
| `tests-api` | 74 API tests, no browser |
| `tests-ui` | Chromium ×3 shards (full regression) + Firefox/WebKit `@smoke` + mobile |
| `tests-a11y` · `tests-visual` | axe-core scans, baseline comparison |
| `perf-smoke` | k6, 10 VU / 30 s, `p95 < 500 ms` |
| `demo-defauts` | Rebuild with the seeded defects and **assert the suite fails** |
| `rapport` | Merge blob reports into one HTML report + job summary |

The application is built **once** and downloaded by every test job. Seven jobs each building their
own copy is seven jobs that can disagree about what they are testing.

**`nightly.yml`** — full regression on all three engines (two shards each) and a real load test to
50 VU. Each run appends one line to the `historique-qa` branch — duration, flake rate, failures —
which the published site renders as a trend page: a per-run report says what broke, that one says
since when. Everything the PR pipeline trims for speed. A two-hour feedback loop on a pull request is a
feedback loop nobody uses.

**`baselines-visuelles.yml`** — regenerates visual baselines inside the CI container and commits
them, with the PNGs also published for review.

**`pages.yml`** — publishes the merged report to
**<https://gungagungi.github.io/music-website/>**, daily at 02:30 UTC and on demand, with the QA
documentation rendered as HTML under `/docs` (dead internal links fail the build rather than ship). It runs its
own suite rather than reusing the nightly's report: depending on an artifact produced by another
workflow would break publication every time the nightly fails — and a red report is exactly what
you want published.

## Does any of it catch anything?

A green pipeline proves nothing about a suite's ability to detect. Three defects sit in the
codebase behind `SEED_BUGS=1`, chosen for being hard to catch rather than easy to demonstrate:

| Defect | Why this one | Caught by |
| --- | --- | ---: |
| [BUG-001](docs/bug-reports/BUG-001-coupon-rounding.md) — discount truncated to whole euros | Wrong by cents; a smoke test that checks "a discount appeared" passes on it | 5 tests |
| [BUG-002](docs/bug-reports/BUG-002-sort-after-pagination.md) — sort applied after pagination | Every page looks correctly sorted; only the concatenation reveals it | 2 tests |
| [BUG-003](docs/bug-reports/BUG-003-missing-form-labels.md) — form field with no label | The most common real accessibility defect | 11 tests |

```bash
SEED_BUGS=1 NEXT_PUBLIC_SEED_BUGS=1 npm run build -w app
SEED_BUGS=1 npm run start -w app
npm run test:bugs -w e2e
```

The specs assert the **correct** behaviour, so they are green on a normal build and red on a
bugged one — rather than asserting a bug is still present, which is an assertion you have to
delete the day it gets fixed.

The `demo-defauts` CI job runs this and **fails if the suite passes**, making detection a real
gate on coverage rather than a claim in a README.

### Mutation testing, where the money is

Seeded defects answer the question for three known bugs. Mutation testing asks it in general, and
without anyone choosing the defect in advance: Stryker rewrites the source — `>=` becomes `>`,
`Math.round` becomes `Math.floor`, a `+` becomes a `-` — and counts the versions the suite still
calls correct. A surviving mutant is a line of code no assertion depends on.

It runs on the pricing arithmetic only: `lib/money.ts`, and the pure functions of `lib/cart.ts`.
That is where a wrong answer is a wrong amount charged to somebody. 103 mutants, **100 % killed**,
and the CI job breaks below that — a score that is merely published drifts down without anyone
noticing.

Two mutants are *equivalent*: the mutated code behaves identically to the original, so no test can
kill them, and Stryker has no way to know that. They are marked in the source with the reasoning
that makes them equivalent — `-Math.round(-0)` returns `+0`, so `value < 0` and `value <= 0` agree
everywhere. Marking them is deliberate: lowering the threshold to 98 % to accommodate them would
also accommodate the next two real survivors.

The exercise paid for itself immediately. It found that nothing pinned whether a coupon expiring
"on 31 December" is still valid *at* its expiry instant — a business rule the code answered and no
test asserted. Two tests with a frozen clock now hold both sides of that millisecond.

```bash
npm run test:mutation        # ~45 s, HTML report in app/reports/mutation/
```

## Three problems worth reading about

The interesting part of this project is not the green tick. It is what the first real CI run
exposed, none of which static validation could see.

**Firefox never started.** Every one of its tests failed in ~20 ms, before a page opened. Firefox
refuses to run as root when `$HOME` belongs to another user, and the Playwright container's
default `/github/home` belongs to `pwuser`.

**The report merge refused to run.** Container jobs check out to `/__w/…` and host jobs to
`/home/runner/work/…`; blob reports record the absolute `testDir`, Playwright sees two, and stops.
A merge config naming the canonical path unblocks it.

**Two tests were flaky, and both were framework defects.** The trace settled it: at the moment of
failure the coupon field was empty and the page read *"Les données envoyées sont invalides"* — the
form had been submitted with nothing in it. The cause was hydration, and the first fix was
**wrong**: confirming the field holds the value is a snapshot, and hydration can land between the
confirmation and the click that follows. The right fix was an explicit readiness signal —
[ADR-003](docs/adr/003-hydration-readiness.md) records the failed attempt as well as the accepted
one, because the failed attempt is what explains the shape of the answer.

## Documentation

| Document | What it answers |
| --- | --- |
| [Test strategy](docs/test-strategy.md) | Risk analysis, layering, data policy, how instability is handled |
| [Test plan](docs/test-plan.md) | What runs, where, when, at what cost |
| [Requirements](docs/requirements.md) | The 139 `REQ-*` |
| [Test cases](docs/test-cases/) | Generated catalogue + six journeys written out in full |
| [Traceability matrix](docs/traceability-matrix.md) | Both directions, generated, CI-verified |
| [Bug reports](docs/bug-reports/) | Three defects with real reproduction data |
| [ADRs](docs/adr/) | Five decisions, with what each one costs |
| [Deployment](docs/deployment.md) | Docker Compose on a VPS, backups, and the post-deployment check |

## Known limitations

Stated rather than glossed over — the boundaries are part of the design.

- **`ON DELETE RESTRICT` is asserted by the schema and nothing else.** The application has no way
  to delete a product, so a suite that speaks only HTTP cannot reach the constraint. Testing it
  would mean giving the suite a SQL connection or inventing an endpoint that exists to be tested;
  neither is worth it. Named in [ADR-005](docs/adr/005-persistent-postgres.md) rather than left to
  be discovered.
- **`test:visual` fails locally.** Baselines belong to the CI container
  ([ADR-004](docs/adr/004-visual-baselines.md)).
- **Accessibility is scanned, not certified.** axe-core catches roughly a third to a half of WCAG
  issues. Keyboard and text-alternative checks are added on top, but passing is not a conformance
  claim.
- **Checkout is excluded from the load test.** It decrements real stock, and a load test that
  empties the catalogue leaves the environment unusable for the suite that runs next.
- **Performance thresholds detect a class of regression, not a 20 % slowdown.** They sit at five
  times a baseline measured on the CI runner itself ([`perf/baseline.json`](perf/baseline.json),
  regenerated by the *Mesurer la baseline de performance* workflow), with a floor below which
  multiplying stops meaning anything. Wide enough that a shared runner does not go red on its own
  variance; narrow enough that an N+1 or a lost index lands the wrong side by an order of
  magnitude.
- **No penetration testing.** The security suite covers authorisation, isolation and input
  handling — what a functional QA team can assert. It is not an audit.
- **The hydration marker is a test affordance in production code.** One attribute set by a
  component that renders nothing — small, but it exists for the suite and should be named as such.

### Roadmap

The five items this section carried are done: mutation testing on the pricing arithmetic, a
performance baseline measured on the CI runner, trend reporting across runs, the QA docs rendered
as HTML, and an OpenAPI spec — generated from the contract schemas rather than written beside
them, which is the opposite of how that item was phrased and the reason it is worth reading
[the PR](https://github.com/Gungagungi/music-website/pull/18).

What is left is smaller, and one item is not mine to hide:

- The workflows still run on the Node 20 **action** runtime (`actions/checkout@v4` and friends),
  which GitHub flags on every run. The project itself is on Node 22; clearing the notice means
  moving the actions to their current majors, which is its own change with its own breakage.

---

Demonstration project. No product is actually sold; every brand name is used to make the catalogue
plausible.
