# Critical journeys — detailed test cases

Six cases written out in the classic manual format: preconditions, numbered steps, expected result
per step. The other 169 live in [`test-cases.csv`](test-cases.csv), which is generated.

These six are spelled out because they are the ones worth reviewing with someone who does not read
TypeScript, and because the format makes visible what the automation encodes: what is arranged
versus what is verified, and why each assertion is worded the way it is.

---

## TC-120 — Guest checkout, end to end

| | |
| --- | --- |
| **Requirement** | `REQ-ORDER-01` |
| **Priority** | Critical · `@smoke @critical` |
| **Suite** | UI — `ui/commande.spec.ts` |
| **Type** | Functional, happy path |

**Preconditions** — application running with a reset database; no session.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Arrange a cart with 2 × Boss DS-1 Distortion (€41.30) through the API, then open `/commande` | The funnel opens on the *Livraison* step and a guest notice is visible |
| 2 | Fill the email and a complete delivery address | No validation error |
| 3 | Move to *Paiement*, choose a method, accept the terms | The order button becomes available |
| 4 | Confirm the order | Redirection to the confirmation page |
| 5 | Read the confirmation | Reference matches `FRT-\d{6}`; email matches the one entered; total = €82.60 + €9.90 shipping = **€92.50** |

**Notes.** The cart is arranged through the API on purpose: this case is about *ordering*, and
the clicks that fill a cart are the subject of `TC-067`. Duplicating them here would mean a
broken add-to-cart button fails two cases and the second failure tells you nothing new.

The product is chosen so the subtotal sits **below** the free-shipping threshold — the flat rate
has to appear in the total for the assertion to prove anything.

---

## TC-110 — A valid coupon reduces the total

| | |
| --- | --- |
| **Requirement** | `REQ-COUPON-01` |
| **Priority** | Critical · `@smoke @critical` |
| **Suite** | UI — `ui/panier.spec.ts` |
| **Type** | Functional + calculation |

**Preconditions** — cart holding 2 × Boss DS-1 Distortion, subtotal €82.60.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open `/panier` | The line and the subtotal €82.60 are shown |
| 2 | Enter coupon `BIENVENUE10` and apply | The applied-coupon indicator names `BIENVENUE10` |
| 3 | Read the discount line | **−€8.26** — 10% of €82.60, to the cent |
| 4 | Read the total | €82.60 − €8.26 + €9.90 = **€84.24** |

**Notes.** The subtotal is deliberately not a round number of euros. A fixture priced at €80.00
would make this case pass on [BUG-001](../bug-reports/BUG-001-coupon-rounding.md), which truncates
the discount to whole euros — the test would exist and prove nothing.

Step 3 expects a **negative** amount, because the summary renders a discount as `- 8,26 €`. The
assertion carries the sign rather than quietly taking an absolute value: `|−8.26| == |8.26|` would
also accept a discount added to the total instead of subtracted from it.

---

## TC-045 — Pagination neither duplicates nor drops, and respects the sort

| | |
| --- | --- |
| **Requirement** | `REQ-PAGE-02` |
| **Priority** | Critical · `@regression @critical` |
| **Suite** | UI — `ui/tri-pagination.spec.ts` |
| **Type** | Functional, data integrity |

**Preconditions** — the *Guitares électriques* department holds 13 products, page size 12.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open the department and sort by ascending price | Page 1 shows 12 products |
| 2 | Record the slugs and prices on page 1 | — |
| 3 | Go to page 2 | 1 product |
| 4 | Record the slugs and prices on page 2 | — |
| 5 | Concatenate the slugs | 13 distinct slugs — no duplicate, no gap |
| 6 | Concatenate the prices | The sequence is ascending **across both pages** |

**Notes.** Step 6 is the one that matters and it was missing at first. Step 5 alone — set
integrity — passes on [BUG-002](../bug-reports/BUG-002-sort-after-pagination.md), because sorting
each page after slicing loses nothing: every product is still present exactly once, and each page
still looks perfectly ordered on its own. Only the concatenation exposes it.

The general lesson: **an assertion about a set cannot catch a defect about an order.** Both
properties have to be stated, separately.

---

## TC-293 — A client-supplied price is ignored

| | |
| --- | --- |
| **Requirement** | `REQ-SEC-09` |
| **Priority** | Critical · `@security @critical` |
| **Suite** | API — `api/negatifs-securite.spec.ts` |
| **Type** | Security, negative |

**Preconditions** — an empty cart.

| # | Step | Expected |
| --- | --- | --- |
| 1 | `POST /api/cart/items` with a valid SKU plus forged `unitPrice`, `price` and `lineTotal` fields, all set to `1` | 201 — the extra fields are ignored, not honoured |
| 2 | Read the returned cart | `unitPrice` is the catalogue price (€2 799.00), not €0.01 |
| 3 | Read the subtotal | Equal to the catalogue price, recomputed server-side |
| 4 | Validate the response against the strict schema | No unexpected field |

**Notes.** The attack is the oldest one in e-commerce: trust the client for the amount. Asserting
only the HTTP status would miss it entirely — a 201 is exactly what a vulnerable server returns,
because adding the item *did* succeed. The verification has to be on the recomputed amount.

Three field names are forged rather than one: a server that ignores `price` may still honour
`unitPrice`, and guessing which name the implementation uses is not the tester's job.

Step 4 matters as much as step 2. Every response schema is declared `.strict()`, so a server that
started echoing a `price` field back would fail the contract even though no one wrote an assertion
about that field. The same mechanism is what enforces `REQ-SEC-14` — no response may leak
`passwordHash`.

---

## TC-321 — The checkout funnel is completable by keyboard alone

| | |
| --- | --- |
| **Requirement** | `REQ-A11Y-05` |
| **Priority** | Critical · `@regression @critical` |
| **Suite** | Accessibility — `a11y/accessibilite.spec.ts` |
| **Type** | Accessibility, manual-equivalent |

**Preconditions** — cart holding one product; funnel open on *Livraison*.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Focus the email field and type an address | The field receives the text |
| 2 | Move through every field with `Tab` alone, filling as you go | Each field is reached in visual order; none is skipped |
| 3 | Reach the terms checkbox and toggle it with `Space` | The checkbox toggles |
| 4 | Submit with `Enter` | The funnel advances |

**Notes.** This is the case an axe-core scan cannot replace. A scan verifies that elements are
correctly labelled and exposed; it does not verify that they can be *reached* in a sensible order.
A field pulled out of the tab order by a stray `tabindex` passes every automated scan and is
unusable without a mouse.

Step 2 deliberately uses `Tab` rather than clicking each field: any field skipped by the tab order
is unreachable for a keyboard user, and the sequence of typed values is what detects it — the
values end up in the wrong fields.

---

## TC-332 — The promotional product card is visually stable

| | |
| --- | --- |
| **Requirement** | `REQ-VIS-02` |
| **Priority** | High · `@regression @critical` |
| **Suite** | Visual — `visual/composants.visual.spec.ts` |
| **Type** | Visual regression |

**Preconditions** — run in the CI container; the discounted product is on the catalogue page.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open the department containing the discounted product | The card is visible |
| 2 | Wait for fonts to load and animations to be disabled | The page is stable |
| 3 | Capture the card and compare to `product-card-promo-visual-linux.png` | Difference ≤ 1% of pixels |

**Notes.** The card carries five things at once — image, brand, name, rating, current price,
struck-through price, discount badge, stock status — which is why it is worth a baseline: a
regression in any of them shows up here without needing eight separate assertions.

This case **fails on a workstation, by design**. Baselines belong to the CI container; font
metrics differ enough between distributions to shift every word a few pixels, which is a 6% diff
with no regression behind it. See [ADR-004](../adr/004-visual-baselines.md). Updating the baseline
means dispatching the *Régénérer les baselines visuelles* workflow and reviewing the PNG diff —
never raising the tolerance, which would blind the case to the regressions it exists to catch.
