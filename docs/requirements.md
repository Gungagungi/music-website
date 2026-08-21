# Requirements

The `REQ-*` catalogue the suite is written against. Each identifier is referenced from the specs
through `covers('REQ-XXX-NN')`, which is what makes the
[traceability matrix](traceability-matrix.md) derivable rather than aspirational.

129 requirements, all covered. Coverage per requirement is in the matrix; this document is the
statement of intent.

A note on framing: Fretline has no product owner, so these were written the way a QA engineer
writes them when handed a system and asked what it should do — behaviour that is observable and
falsifiable, never implementation. "The cart shows VAT contained within the total" is testable.
"The cart calls `vatIncludedIn()`" is not a requirement, it is a fact about the code.

---

## Storefront

### Home and navigation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-HOME-01` | The home page presents the shop | Hero, department list, and three product selections (best sellers, new arrivals, deals) are visible |
| `REQ-NAV-01` | Departments are reachable from the header | Selecting a department navigates to its catalogue page with the matching heading |
| `REQ-NAV-02` | A breadcrumb reflects the catalogue hierarchy | The product page shows its category; following the breadcrumb returns to that category |

### Display theme

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-THEME-01` | The site follows the device's colour scheme by default | With no explicit choice stored, a device set to dark renders the dark palette, and one set to light renders the light palette |
| `REQ-THEME-02` | The theme can be switched by hand from the header | A control next to the cart cycles System → Light → Dark → System, and shows which of the three is active |
| `REQ-THEME-03` | An explicit choice overrides the device preference | Choosing light on a device set to dark keeps the light palette |
| `REQ-THEME-04` | An explicit choice survives navigation and reload | The chosen theme is already applied on the served document, before hydration — no flash of the other theme |
| `REQ-THEME-05` | Following the device is reachable again after an explicit choice | Completing the cycle clears the stored choice, so the site tracks the device once more |

`REQ-THEME-05` exists because the first implementation lacked it: a two-state toggle locks the
visitor into an explicit choice on the very first click, and nothing in the interface offers a way
back — the device preference is then unreachable short of clearing browser storage. The defect is
invisible to a test that only checks that switching works.

`REQ-THEME-04` is the one worth automating carefully. A theme that is *eventually* correct passes
any assertion made after page load; the defect it hides is a visible flash, and the only place it
is observable is the state of the document before the framework has run.

### Catalogue and facets

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-CAT-01` | An unfiltered category lists its products | Result count matches the category total; every card belongs to that category |
| `REQ-CAT-02` | Products can be filtered by brand | Selecting a brand restricts results to it, is reflected in the URL, and is reversible; several brands combine as a union |
| `REQ-CAT-03` | Products can be filtered by price range | Every result sits within the requested bounds |
| `REQ-CAT-04` | Products can be filtered by availability, promotion and left-handedness | Each flag restricts results to items carrying that property |
| `REQ-CAT-05` | Products can be filtered by minimum rating | No result rates below the threshold |
| `REQ-CAT-06` | Facets combine as a conjunction | Results satisfy every active facet at once |
| `REQ-CAT-07` | Facets can be cleared in one action | Clearing restores the full department and empties the query string |
| `REQ-CAT-08` | An over-restrictive filter shows an explicit empty state | An empty-state message is shown; no card is rendered; no error |
| `REQ-CAT-09` | Facet state lives in the URL | A reload preserves the selection; the URL alone reproduces the filtered view |

### Sorting and pagination

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-SORT-01` | Results can be sorted by price | Ascending and descending both order the **whole** result set; returning to relevance drops the parameter from the URL |
| `REQ-SORT-02` | Results can be sorted by rating | Highest-rated products come first |
| `REQ-PAGE-01` | Long departments are paginated | Pages hold the configured page size; the control disappears when everything fits on one page |
| `REQ-PAGE-02` | Pagination neither duplicates nor drops products | Concatenating pages yields each product exactly once, and the concatenation respects the active sort |
| `REQ-PAGE-03` | Sorting survives a page change | The sort parameter is preserved when navigating between pages |
| `REQ-PAGE-04` | Filtering from a later page returns to page one | Applying a facet resets the page index |

`REQ-PAGE-02` is the requirement [BUG-002](bug-reports/BUG-002-sort-after-pagination.md) violates: each page looks
correctly sorted while the overall sequence is wrong. It is stated as a property of the
concatenation for exactly that reason.

### Search

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-SEARCH-01` | Search is reachable from every page | Submitting from the header navigates to the results page with the term in the URL |
| `REQ-SEARCH-02` | Search matches brand and SKU, not only names | Searching a brand or an exact SKU returns the expected products |
| `REQ-SEARCH-03` | Search ignores case and diacritics | "pedale" and "Pédale" return the same results |
| `REQ-SEARCH-04` | Multi-term search narrows results | Every result matches all terms |
| `REQ-SEARCH-05` | A fruitless search explains itself | An explicit message and a suggestion are shown; an empty query does not error |
| `REQ-SEARCH-06` | Search results can be sorted | The active sort applies to the whole result set |

### Product page

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-PDP-01` | The product page states identity, price and availability | Brand, name, SKU, price and stock status are visible |
| `REQ-PDP-02` | Specifications are listed | Specification terms and values are rendered; the left-handed badge appears when applicable |
| `REQ-PDP-03` | A discount shows both prices and the percentage | Current price, struck-through list price and discount badge are consistent |
| `REQ-PDP-04` | An out-of-stock product cannot be added to the cart | The add button is disabled and the unavailability is stated |
| `REQ-PDP-05` | Rating and review count agree with the reviews shown | The aggregate matches the review list; publishing a review moves it |
| `REQ-PDP-06` | Related products are suggested | Suggestions exist and exclude the current product |
| `REQ-PDP-07` | An unknown product returns 404 | The response status is 404 and a not-found page is shown |

### Comparator

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-CMP-01` | Products can be compared side by side | Products added from the catalogue or the product page appear as columns and can be removed |
| `REQ-CMP-02` | The comparator holds at most three products | A fourth addition is refused with an explanation |
| `REQ-CMP-03` | Heterogeneous specifications align | A specification absent from one product renders as an explicit gap, not a shifted row |
| `REQ-CMP-04` | An empty comparator invites a selection | An empty state with a route back to the catalogue is shown |

## Cart and checkout

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-CART-01` | The cart reflects its contents | Empty at first visit with a route back to the catalogue; otherwise lines, quantities and totals match what was added |
| `REQ-CART-02` | A product can be added from its page | The cart badge and the cart page both reflect the addition |
| `REQ-CART-03` | Colour variants are distinct cart lines | Two colours of the same product do not merge |
| `REQ-CART-04` | Shipping follows the free-shipping threshold | Below the threshold a flat rate applies; at or above it shipping is free |
| `REQ-CART-05` | Quantity per line is capped | The cap is enforced by the server, not only by the input |
| `REQ-CART-06` | Quantity changes recompute line and totals | Line total, subtotal and badge all follow |
| `REQ-CART-07` | Lines can be removed | Removal leaves other lines untouched; removing the last one restores the empty state |
| `REQ-CART-08` | VAT is contained in the total, not added to it | The displayed VAT equals the VAT contained in the VAT-inclusive total |
| `REQ-COUPON-01` | A valid coupon reduces the total | The discount matches the coupon percentage, to the cent |
| `REQ-COUPON-02` | A coupon can be removed | The original total is restored |
| `REQ-COUPON-03` | Unknown and expired coupons are refused | A distinct, explicit message is shown for each |
| `REQ-COUPON-04` | A coupon below its minimum spend is refused | The message names the minimum |
| `REQ-COUPON-05` | A category-scoped coupon only applies to that category | A cart without that category is refused |
| `REQ-ORDER-01` | A guest can order end to end | The funnel completes and a confirmation with an order reference is shown |
| `REQ-ORDER-02` | An authenticated customer finds the order in their history | The order appears in the account history after checkout |
| `REQ-ORDER-03` | The funnel can be navigated backwards | Returning to a previous step preserves entered data |
| `REQ-ORDER-04` | Delivery addresses are validated | Missing fields and malformed postcodes are reported per field |
| `REQ-ORDER-05` | Terms must be accepted | The order is refused until the box is ticked |
| `REQ-ORDER-06` | A cart discount carries through to the order | The order total matches the discounted cart total |
| `REQ-ORDER-07` | The cart is emptied by a successful order | The badge returns to zero |
| `REQ-ORDER-08` | Checkout with an empty cart offers a way back | An explicit state with a link to the catalogue, not an error |

`REQ-COUPON-01` states "to the cent" because that is precisely what
[BUG-001](bug-reports/BUG-001-coupon-rounding.md) breaks — a requirement written as "reduces the total" would be
satisfied by the bug.

## Account and authentication

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-AUTH-01` | A visitor can create an account | Registration succeeds and opens an authenticated session |
| `REQ-AUTH-02` | An email address is unique | A second registration with the same address is refused with an explicit message |
| `REQ-AUTH-03` | Registration input is validated | Malformed email and too-short password are reported per field |
| `REQ-AUTH-04` | Valid credentials open a session | Login succeeds and the account area becomes reachable |
| `REQ-AUTH-05` | Login returns the customer where they were going | After logging in from a protected page, the customer lands on it |
| `REQ-AUTH-06` | Logging out closes the session | Protected pages become unreachable again |
| `REQ-ACC-01` | An account with no orders says so | The history shows an empty state rather than a blank page |

## REST API

Contract-level requirements. Each is asserted against a `.strict()` Zod schema, so an
undocumented extra field fails the test rather than passing unnoticed.

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-API-01` | `GET /api/products` returns a paginated catalogue | Response matches the contract; totals and page metadata are coherent |
| `REQ-API-02` | Products can be filtered by category | Every item belongs to the requested category |
| `REQ-API-03` | Products can be filtered by price range | Every item sits within the bounds |
| `REQ-API-04` | Sorting is total and stable | Ties are broken deterministically; repeated calls return the same order |
| `REQ-API-05` | Pagination is lossless | Pages concatenate to the full set with no duplicate and no gap |
| `REQ-API-06` | Filters combine | Results satisfy every parameter simultaneously |
| `REQ-API-07` | Full-text search is supported | `q` matches name, brand and SKU |
| `REQ-API-08` | `GET /api/products/:slug` returns the full product | Specifications, reviews and aggregates are included |
| `REQ-API-09` | An unknown slug returns 404 | Error envelope with `NOT_FOUND` |
| `REQ-API-10` | `GET /api/categories` lists categories | Contract respected; counts are coherent |
| `REQ-API-11` | `GET /api/brands` lists brands | Contract respected |
| `REQ-API-20` | `POST /api/cart/items` adds a line | 201 and the updated cart |
| `REQ-API-21` | Totals are computed server-side | Subtotal, discount, shipping, VAT and total are mutually consistent, in integer cents |
| `REQ-API-22` | Identical items merge, variants do not | Same SKU and colour increments quantity; a different colour creates a line |
| `REQ-API-23` | `PATCH` updates a quantity | Quantity zero removes the line |
| `REQ-API-24` | An unknown line returns 404 | Error envelope with `NOT_FOUND` |
| `REQ-API-25` | An out-of-stock product is refused | 409 with `OUT_OF_STOCK` |
| `REQ-API-26` | The quantity cap is enforced server-side | Above the cap is refused regardless of the client |
| `REQ-API-27` | An invalid colour is refused | 422 with a validation error |
| `REQ-API-28` | The cart can be emptied | The cart returns to zero lines |
| `REQ-API-30` | `POST /api/orders` creates an order | 201 with a unique order reference |
| `REQ-API-31` | Ordering decrements stock | Stock drops by exactly the ordered quantity |
| `REQ-API-32` | Ordering empties the cart | The cart is empty afterwards |
| `REQ-API-33` | An empty cart cannot be ordered | 422 with an explicit code |
| `REQ-API-34` | Order addresses are validated | Missing or malformed fields are reported in `details` |
| `REQ-API-35` | Terms acceptance is enforced server-side | Refused without it |
| `REQ-API-36` | A guest order requires an email address | Refused without it |
| `REQ-API-40` | `POST /api/cart/coupon` applies a coupon | The discount matches the percentage, in cents |
| `REQ-API-41` | Invalid coupons are refused with a distinct code | `COUPON_UNKNOWN` (404), `COUPON_EXPIRED`, `COUPON_MIN_SUBTOTAL` (422) |
| `REQ-API-42` | A category-scoped coupon is refused off-category | 422 with `COUPON_CATEGORY` |
| `REQ-API-43` | A coupon is re-evaluated when the cart changes | A coupon that no longer qualifies is dropped and the discount returns to zero |
| `REQ-API-44` | `POST /api/coupons/validate` simulates without applying | The preview returns the discount; the cart is untouched |
| `REQ-API-45` | A coupon can be removed | The original total is restored |
| `REQ-API-50` | `POST /api/reviews` publishes a review | 201; the aggregate rating and count move by one review |
| `REQ-API-51` | One review per customer per product | The second is refused |
| `REQ-API-52` | Ratings are bounded | Out-of-range values are refused with 422 |
| `REQ-API-60` | Malformed input is distinguished from invalid input | Malformed JSON returns 400 `INVALID_JSON`; a schema violation returns 422 `VALIDATION_ERROR` |
| `REQ-API-61` | Out-of-range query parameters degrade gracefully | An excessive limit, a page past the end and an unknown sort are handled without a 500 |
| `REQ-OPS-01` | `GET /api/health` reports service state | 200 with a status field, no authentication required |

`REQ-API-60` is one of the few requirements that exists because of a testing insight rather than a
product one: distinguishing "you sent me something that is not JSON" from "you sent me JSON I do
not accept" is what lets a client tell a transport bug from a validation bug.

## Data integrity and persistence

Everything in this section became reachable only when the shop moved from an in-memory store to
PostgreSQL (ADR-005). A single process mutating a plain object has no transactions, no isolation
level and no interleaving to get wrong: these defects could not occur, and therefore could not be
tested for. They are what the migration was for.

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-DATA-01` | Two customers cannot buy the same last unit | Simultaneous checkouts on a stock of one yield exactly one order and one `OUT_OF_STOCK`; stock ends at zero |
| `REQ-DATA-02` | Stock never goes negative | A cart larger than the remaining stock is refused, and the refusal consumes nothing |
| `REQ-DATA-03` | Checkout is all or nothing | A checkout refused on one line decrements no other line, writes no order, and leaves the cart intact |
| `REQ-DATA-04` | An address can be registered once | Simultaneous registrations of the same address yield one account and one `CONFLICT` |
| `REQ-DATA-05` | Data survives a restart | An order placed before a full stop is readable after it, with its lines, totals and stock movement — verified by `scripts/verifier-persistance.sh` |
| `REQ-DATA-10` | A cart is created only when something is put in it | Reading the cart, or validating a coupon, writes no row |
| `REQ-DATA-11` | Empty carts are short-lived | Kept for a plausible browsing session, deleted after a day |
| `REQ-DATA-12` | Guest carts outlive their cookie by nothing | Deleted once the `fretline_cart` cookie can no longer address them |
| `REQ-DATA-13` | A cart attached to an account is exempt from the guest window | Same age as a deleted guest cart, and it is kept |
| `REQ-DATA-14` | Dormant account carts are eventually swept | Deleted after a year — data protection, not housekeeping |

`REQ-DATA-13` is the one that carries the policy. `REQ-DATA-11` and `REQ-DATA-12` would both pass
against a purge that simply deleted everything old enough; only the exemption distinguishes a
retention policy from a `DELETE ... WHERE updated_at <`.

`REQ-DATA-05` is verified against the deployed stack rather than in the Playwright suite, which
cannot restart the server it is talking to. `scripts/verifier-persistance.sh` places an order,
stops the containers, brings them back and re-reads it; the `deploiement` CI job runs it on every
push.

## Security

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-SEC-01` | Bad credentials are refused without disclosing account existence | Same message and status whether or not the account exists |
| `REQ-SEC-02` | Protected endpoints require a token | 401 `UNAUTHORIZED` without one |
| `REQ-SEC-03` | An order confirmation is not public | Another customer cannot read it |
| `REQ-SEC-04` | Carts are isolated | One session cannot read or modify another's cart |
| `REQ-SEC-05` | A guest order is retrievable only with its token | Without the token, access is refused |
| `REQ-SEC-06` | Orders are partitioned by customer | A customer sees only their own orders, individually and in their history |
| `REQ-SEC-07` | Publishing a review requires authentication | 401 without a token |
| `REQ-SEC-08` | Negative or zero quantities are refused | 422; no cart mutation |
| `REQ-SEC-09` | Client-supplied prices are ignored | A tampered price does not change the server-computed total |
| `REQ-SEC-10` | Hostile payloads are handled as data | Injection-shaped strings are stored or rejected, never interpreted |
| `REQ-SEC-11` | A forged or altered token is rejected | 401; the signature is verified |
| `REQ-SEC-12` | Test endpoints are unreachable in normal mode | 404 without `E2E_TEST_MODE`, refused without a valid `x-test-token` |
| `REQ-SEC-13` | An unknown route returns a structured 404 | Error envelope, no stack trace |
| `REQ-SEC-14` | No response ever exposes a password hash | `.strict()` schemas reject any extra field, `passwordHash` included |
| `REQ-SEC-15` | Test-created accounts are isolated from each other | Each worker's account sees only its own profile |
| `REQ-SEC-16` | The audience tracker never loads under test | No Matomo tag is served while `E2E_TEST_MODE=1`, whatever the build carries |

`REQ-SEC-16` guards determinism as much as privacy: a third-party script slipping into the suite
would add an uncontrolled network request between assertions, and pixel-compared screenshots would
start to drift for reasons no diff can explain.

`REQ-SEC-14` is enforced structurally rather than by assertion: because every response schema is
`.strict()`, a leak fails the contract test whether or not anyone thought to check for that
particular field.

## Accessibility

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-A11Y-01` | Main pages have no serious or critical WCAG 2.1 A/AA violation | axe-core scan on home, catalogue, product, search, login, registration, comparator and cart |
| `REQ-A11Y-02` | The checkout funnel is accessible | Same criterion applied to each funnel step |
| `REQ-A11Y-03` | Form fields have associated labels, and errors are announced | Every input has a programmatic label; validation errors are exposed to assistive technology |
| `REQ-A11Y-04` | A skip link leads to the main content | Reachable on first tab, and it works |
| `REQ-A11Y-05` | The core journey is operable by keyboard | Catalogue to cart without a pointer, focus always visible |
| `REQ-A11Y-06` | Informative images have text alternatives | Product images carry a meaningful alternative; decorative images are hidden from the tree |
| `REQ-A11Y-07` | The dark theme meets the same contrast requirements | axe-core scan with the device set to dark reports no serious or critical violation |

`REQ-A11Y-03` is what [BUG-003](bug-reports/BUG-003-missing-form-labels.md) violates.

## Visual regression

Baselines are captured in the CI container on one engine — see
[ADR-004](adr/004-visual-baselines.md).

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| `REQ-VIS-01` | Global chrome is visually stable | Header, hero and footer match their baselines |
| `REQ-VIS-02` | Product cards are visually stable | Standard and out-of-stock variants match |
| `REQ-VIS-03` | The facet panel is visually stable | Matches its baseline |
| `REQ-VIS-04` | The product buy box is visually stable | Matches its baseline |
| `REQ-VIS-05` | The cart summary with a discount is visually stable | Matches its baseline |
| `REQ-VIS-06` | Empty states are visually stable | Empty cart and empty catalogue match their baselines |
