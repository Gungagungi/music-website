# Test cases

175 test cases, all automated, all traced to a requirement.

| File | Content |
| --- | --- |
| [`test-cases.csv`](test-cases.csv) | The full catalogue — **generated**, importable into any test management tool |
| [`critical-journeys.md`](critical-journeys.md) | Six cases written out in full, in the classic manual format |

## Why the catalogue is generated

Writing 175 test cases by hand into a document, then maintaining them alongside the code, is a
losing proposition. It starts accurate, survives two sprints, and then quietly describes a suite
that no longer exists — at which point it is worse than nothing, because people still trust it.

So the catalogue is derived from the suite. Each spec declares its identity inline:

```ts
test(
  'un code valide applique la remise et recalcule le total',
  {
    tag: [TAGS.smoke, TAGS.critical],
    annotation: [testCase('TC-110', 'Code promo valide'), covers('REQ-COUPON-01')],
  },
  async ({ cartWith, cartPage }) => { /* … */ },
);
```

`node scripts/traceability.mjs` reads those annotations through Playwright's own reporter and
emits `test-cases.csv` and the [traceability matrix](../traceability-matrix.md). CI runs the same
script with `--check` and fails if the committed files no longer match the code, so the
documentation cannot silently rot. The script also rejects duplicate identifiers — a single `TC`
covering three distinct verifications makes the matrix lie, which is exactly how `TC-271` was
found covering three coupon-rejection scenarios at once.

```bash
npm run trace -w e2e          # regenerate
npm run trace:check -w e2e    # verify (what CI runs)
```

## CSV columns

| Column | Content |
| --- | --- |
| `test_case_id` | `TC-XXX`, unique, stable |
| `name` | Short business name |
| `suite` | `API` · `UI` · `Accessibility` · `Visual` |
| `group` | `describe` block the test lives in |
| `automated_test` | Test title, verbatim |
| `spec_file` | Path relative to `e2e/tests/` |
| `tags` | `@smoke` `@regression` `@critical` `@contract` `@security` `@known-bug` |
| `requirements` | `REQ-*` identifiers covered |
| `known_bug` | `BUG-*` when the case demonstrates a seeded defect |

## Identifier ranges

| Range | Area |
| --- | --- |
| `TC-001` | Health probe |
| `TC-010` … `TC-071` | Storefront — home, catalogue, sorting, pagination, search, product page |
| `TC-080` … `TC-088` | Authentication (UI) |
| `TC-100` … `TC-129` | Cart, coupons, checkout |
| `TC-140` … `TC-145` | Comparator |
| `TC-200` … `TC-301` | REST API — auth, products, cart, orders, coupons, reviews, security |
| `TC-310` … `TC-322` | Accessibility |
| `TC-330` … `TC-339` | Visual regression |
| `TC-350` … `TC-352` | Seeded-defect demonstrations |

Gaps between ranges are deliberate: a new cart case gets a number next to the other cart cases,
not appended at the end where nobody would look for it.

## Why so much of it is API-level

64 of the 175 cases run without a browser, in about ten seconds. Every negative case, every
contract check, every security assertion lives there. Driving "a negative quantity is rejected"
through a browser would cost sixty times more and prove less, because the browser's own input
validation would mask the server behaviour under test. The reasoning is set out in the
[test strategy](../test-strategy.md#2-shape-of-the-suite).
