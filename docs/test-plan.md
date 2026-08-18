# Test plan

Companion to the [test strategy](test-strategy.md). The strategy explains why the suite is shaped
this way; this document says what runs, where, when, and what it costs.

- **Product**: Fretline — guitar and bass e-commerce demonstration site
- **Version under test**: `main`
- **Test items**: `app/` (Next.js application + REST API), verified through `e2e/` and `perf/`

---

## 1. Scope

### In scope

| Area | Coverage | Requirements |
| --- | --- | --- |
| Catalogue | Facets (brand, price, availability, promotion, left-handed, rating), sorting, pagination, empty states, URL persistence | `REQ-CAT-*`, `REQ-SORT-*`, `REQ-PAGE-*` |
| Search | Header search, brand and SKU lookup, accent normalisation, multi-term, no-result path | `REQ-SEARCH-*` |
| Product page | Identity, price and strike-through, availability, specifications, reviews, related products, 404 | `REQ-PDP-*` |
| Cart | Add, quantity, colour variants, removal, shipping threshold, VAT breakdown, coupons | `REQ-CART-*`, `REQ-COUPON-*` |
| Checkout | Three-step funnel, address validation, terms, guest and authenticated orders, stock decrement | `REQ-ORDER-*` |
| Authentication | Registration, login, logout, session persistence, redirect after login | `REQ-AUTH-*` |
| Comparator | Up to three products, heterogeneous specifications, removal, empty state | `REQ-CMP-*` |
| REST API | All endpoints, response contracts, pagination, filters, error codes | `REQ-API-*` |
| Security | Authorisation, cart and order isolation, hostile payloads, price tampering, forged tokens | `REQ-SEC-*` |
| Accessibility | WCAG 2.1 A/AA scans on six pages, skip link, keyboard path, text alternatives | `REQ-A11Y-*` |
| Visual | Ten component baselines | `REQ-VIS-*` |
| Performance | Catalogue and cart endpoints under load | — |

### Out of scope

Listed with reasons in [test strategy §6](test-strategy.md#6-what-is-deliberately-out-of-scope).
In short: no checkout load test, no cross-browser baselines, no penetration testing, no unit tests
of application internals, and accessibility is scanned rather than certified.

## 2. Coverage as it stands

| Suite | Test cases | Runtime | Browser |
| --- | ---: | ---: | --- |
| API | 74 | ~15 s | none |
| UI | 88 | ~5 min | Chromium (full), Firefox + WebKit (`@smoke`), mobile Chrome |
| Accessibility | 13 | ~1 min 30 | Chromium |
| Visual | 10 | ~40 s | Chromium |
| **Total** | **185** | **~15 min cumulative** | |

185 test cases against 139 requirements, 0 without a requirement and 0 requirement without
coverage — see the
[traceability matrix](traceability-matrix.md), which is generated from the annotations and
verified in CI.

Tag distribution: `@smoke` 42 · `@regression` 134 · `@critical` 61 · `@contract` 21 ·
`@security` 19 · `@known-bug` 3.

## 3. Environments

| Environment | Purpose | Notes |
| --- | --- | --- |
| Local | Development and debugging | Production build served on `:3000`, `E2E_TEST_MODE=1`. The dev server is **not** used — its compile-on-demand latency makes first navigation unpredictable. |
| CI — runner host | API tests, performance, quality gates | `ubuntu-latest` |
| CI — container | Every browser suite | `mcr.microsoft.com/playwright:v1.62.1-noble`, pinned to the `@playwright/test` version because the image ships matching browser binaries |

The application under test is **built once** in the `qualite` job and downloaded by every test
job. Seven jobs each building their own copy is seven jobs that can disagree about what they are
testing.

Two environment facts that are not obvious and cost real time to rediscover:

- Container jobs need `HOME: /root`. Firefox refuses to launch as root when `$HOME` belongs to
  another user, and the container's default `/github/home` belongs to `pwuser`. Chromium and
  WebKit do not care — Firefox fails before a single test runs.
- Visual baselines belong to the container. Font metrics differ enough between distributions to
  shift every word by a few pixels — a 6% diff with no regression behind it. Baselines are
  regenerated through the *Régénérer les baselines visuelles* workflow, never on a workstation.
  `npm run test:visual` failing locally is expected.

## 4. Test data

| Kind | Source | Lifecycle |
| --- | --- | --- |
| Catalogue (73 products, 9 categories) | Generated deterministically from SKU hashes | Rebuilt only when the source table changes |
| Seeded accounts, coupons | `app/src/data/`, mirrored in `e2e/data/seed.ts` | Restored by `POST /api/test/reset` |
| Accounts, orders, reviews created by tests | Built at runtime, unique per worker | Discarded with the process |
| Stock | Reset plus `STOCK_TOP_UP` for the three products consumed by order specs | Once per run |

The database is reset **once per run**, never per test — see
[test strategy §3](test-strategy.md#3-test-data) for why the obvious alternative is harmful, and
[ADR-002](adr/002-test-data-isolation.md) for the decision record.

Test-only endpoints (`/api/test/reset`, `/seed`, `/state`) are doubly guarded: invisible unless
`E2E_TEST_MODE=1` (they answer 404), then refused without a valid `x-test-token`. `REQ-SEC-12`
asserts the guard, because a test hook reachable in production is a vulnerability, not a
convenience.

## 5. Execution schedule

### On every push and pull request — `ci.yml`, ~6 minutes wall clock

| Job | Content | Gate |
| --- | --- | --- |
| `qualite` | ESLint, `tsc --noEmit`, production build | Blocking |
| `tests-api` | 64 API tests | Blocking |
| `tests-ui` | Chromium full regression across 3 shards; Firefox and WebKit `@smoke`; mobile Chrome | Blocking |
| `tests-a11y` | axe-core WCAG 2.1 A/AA | Blocking |
| `tests-visual` | 10 baselines | Blocking |
| `perf-smoke` | k6, 10 VU / 30 s | Blocking |
| `demo-defauts` | Rebuild with `SEED_BUGS=1`, assert the suite **fails** | Blocking |
| `rapport` | Merge blob reports into one HTML report + job summary | Always runs |

### Nightly at 02:00 UTC — `nightly.yml`

Full regression on all three engines (two shards each) and a real load test — everything the pull
request pipeline trims for speed. A two-hour feedback loop on a PR is a feedback loop nobody uses.

### On demand

- `baselines-visuelles.yml` — regenerate screenshots in the container and commit them
- `pages.yml` — publish the report to <https://gungagungi.github.io/music-website/>; also runs
  daily at 02:30 UTC

## 6. Performance criteria

| Scenario | Load | Thresholds |
| --- | --- | --- |
| `perf/smoke.js` — every PR | 10 VU / 30 s | `p95 < 500 ms`, `p99 < 1000 ms`, failures `< 1%`, catalogue group `p95 < 800 ms` |
| `perf/load.js` — nightly | 20 → 50 VU over 4 min | `p95 < 800 ms`, `p99 < 1500 ms`, failures `< 2%`, cart write `p95 < 600 ms`, journey failures `< 2%` |

Latest smoke run: 1 188 requests, 38.3 req/s, p95 = 20 ms, 0% failures, all four thresholds met.

A 409 "out of stock" is counted as a success, not an HTTP failure — an empty shelf under load is
a business outcome, and counting it as an error made a correctly behaving run go red at 3%.

## 7. Reporting

| Artefact | Where | Retention |
| --- | --- | --- |
| Merged HTML report (all shards and projects) | `rapport-playwright` artifact | 30 days |
| Markdown summary — per project, failures, flakes | Actions job summary | with the run |
| Traces (failures **and** flakes) | `traces-*` artifacts | 7 days |
| Visual diffs | `diffs-visuels` artifact | 7 days |
| k6 results (JSON + Markdown) | `perf-*` artifacts | 7–30 days |
| JUnit XML | `e2e/reports/junit.xml` | local |

Traces are uploaded for flaky tests too. A test that passes on retry is precisely the one that
will not reproduce locally, so its trace is the only evidence there is.

## 8. Roles

A single-maintainer project, so the roles are hats rather than people: whoever changes the
application also updates `e2e/data/seed.ts` when the seed changes, adds `testCase()` and
`covers()` annotations to new specs, and commits the regenerated matrix in the same change. CI
enforces the last point.

## 9. Risks to the plan itself

| Risk | Mitigation |
| --- | --- |
| Baselines drift when the CI image is bumped | Container tag is pinned; a bump is an explicit change with a baseline refresh |
| Suite runtime grows past the point where people bypass it | Sharding plus the smoke/regression split; the PR pipeline is budgeted at under 10 minutes |
| Flaky tests get normalised | Flakes are surfaced separately and treated as merge blockers |
| Documentation drifts from the suite | Matrix and CSV are generated; `trace:check` fails CI when the committed copy is stale |
