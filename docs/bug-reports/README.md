# Bug reports

Three defects live in the codebase behind `SEED_BUGS=1`, off by default. They exist to answer the
question a green pipeline cannot: *would this suite actually catch anything?*

| ID | Title | Severity | Component | Detected by |
| --- | --- | --- | --- | ---: |
| [BUG-001](BUG-001-coupon-rounding.md) | Percentage discount truncated to whole euros | Major | `lib/cart.ts` | 5 tests |
| [BUG-002](BUG-002-sort-after-pagination.md) | Sort applied after pagination | Major | `lib/catalog.ts` | 2 tests |
| [BUG-003](BUG-003-missing-form-labels.md) | Form fields with no programmatic label | Major (a11y) | `Footer.tsx`, `CheckoutForm.tsx` | 11 tests |

Each was chosen for a property that makes it hard to catch, not for being easy to demonstrate:

- **BUG-001** is wrong by cents. A smoke test that checks "a discount was applied" passes on it.
- **BUG-002** is invisible page by page. Every page looks correctly sorted; only the concatenation
  reveals it, and no human computes that.
- **BUG-003** is the single most common accessibility defect in the wild, and its first version
  was *not* caught — axe accepts a placeholder as a last-resort accessible name, so the bugged
  variant had to drop the placeholder too.

## Reproducing

```bash
SEED_BUGS=1 NEXT_PUBLIC_SEED_BUGS=1 npm run build -w app   # the client-component defect is baked in at build time
SEED_BUGS=1 npm run start -w app
npm run test:bugs -w e2e                                    # the three dedicated specs
```

The specs assert the **correct** behaviour, so they are green on a normal build and red on a
bugged one. That is the point: they show the suite catching a regression, rather than asserting
that a bug is still present — an assertion that would have to be deleted the day it gets fixed.

## The CI gate

The `demo-defauts` job rebuilds with the defects enabled and **fails if the suite passes**. The
job is green only when detection works, which makes it a real gate on coverage rather than a claim
in a README. If someone weakens an assertion so that BUG-001 slips through, that job goes red.
