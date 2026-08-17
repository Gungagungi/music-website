# BUG-002 — Sort applied after pagination

| | |
| --- | --- |
| **Severity** | Major |
| **Priority** | Medium |
| **Status** | Open — reproduced on demand via `SEED_BUGS=1` |
| **Component** | Catalogue — `app/src/lib/catalog.ts` |
| **Requirement** | [`REQ-PAGE-02`](../requirements.md#sorting-and-pagination), `REQ-SORT-01`, `REQ-API-05` |
| **Test cases** | `TC-045`, `TC-351` |
| **Environment** | Fretline `main`, Chromium 1.62.1, Linux, `SEED_BUGS=1` |

## Summary

Sorting is applied to the current page instead of the whole result set. Each page is internally
ordered, so nothing looks wrong until you compare across a page boundary — page 2 then opens with
a product cheaper than the last one on page 1.

## Steps to reproduce

1. Open `/c/guitares-electriques?sort=prix-asc` (13 products, 12 per page)
2. Note the prices on page 1
3. Go to page 2
4. Concatenate the two sequences

## Expected

The concatenation is ordered ascending across the whole department:

```
16500, 40755, 49410, 54900, 66430, 69900, 80655, 109900, 124900, 189900, 189900, 229900, 279900
```

## Actual

`49410` is missing from page 1 and appears at the end of page 2:

```
16500, 40755, 54900, 66430, 69900, 80655, 109900, 124900, 189900, 189900, 229900, 279900, 49410
       page 1 (12 produits) ────────────────────────────────────────────────────────┘  page 2 ┘
```

Page 1 holds the 12 cheapest-*looking* products only by accident: it holds the first 12 in
catalogue order, sorted among themselves. `49410` — the 3rd cheapest — is the 13th in catalogue
order, so it lands alone on page 2.

```
Error: La séquence complète n’est pas ordonnée par prix croissant.
- Expected  - 1
+ Received  + 1
    16500,
    40755,
-   49410,
    54900,
    ...
+   49410,
  at tests/ui/tri-pagination.spec.ts:102
```

## Impact

"Cheapest first" does not return the cheapest products. A customer sorting by price sees a
€494.10 guitar buried on page 2 while page 1 stops at €2 799.00 — the exact opposite of what
sorting is for, and directly commercially harmful on a page whose purpose is to surface the
entry-level range.

**The nastiest property of this defect is that it is invisible page by page.** Every page passes a
visual check. A manual tester who inspects page 1, finds it correctly ordered, and moves on will
report nothing. It is only observable in the concatenation, which no human naturally computes.

## Root cause

`app/src/lib/catalog.ts`, `queryProducts()`:

```ts
const pageItems = SORT_AFTER_PAGINATION_ENABLED
  ? sortItems(items.slice(start, start + limit))   // slice, then sort  ← defect
  : sortItems(items).slice(start, start + limit);  // sort, then slice  ← correct
```

Slicing before sorting means the page window is chosen on the unsorted collection. This is the
canonical form of the bug in real catalogues, where it usually appears as a sort pushed into the
wrong layer — ordering the rows already returned by the database rather than the query.

## Detection

Initially caught **only** by the dedicated demonstration spec `TC-351`, which was a gap worth
correcting: a defect that just one purpose-built test can see is not really covered.

`TC-045` (*no product duplicated or dropped between pages*) checked set integrity — every product
present exactly once — which the defect satisfies perfectly, since reordering loses nothing. It now
also asserts that the concatenated prices are ordered, which is what `REQ-PAGE-02` actually
states. The defect is caught by the regular regression suite as a result:

| Test case | Suite | What it asserts |
| --- | --- | --- |
| `TC-045` | UI | Pages concatenate without duplicate or gap **and** respect the active sort |
| `TC-351` | UI | Dedicated demonstration spec |

The lesson generalises: an assertion about a *set* cannot catch a defect about an *order*. Both
properties have to be stated.

## Suggested fix

Keep the correct branch. Sorting belongs before slicing, with a tie-break on a total order (`id`)
so equal prices — `189900` appears twice here — cannot drift between pages on repeated queries.
