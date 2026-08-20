# ADR-006 — Matomo, self-hosted, and invisible to the suite

**Status**: Accepted · **Date**: 2026-08 · **Scope**: deployment, application under test, test
determinism

## Context

The deployed store had no audience measurement at all. The question it needs to answer is not
"how many visits" — that much any counter gives — but the commercial funnel: which products are
viewed, how many of those views reach a cart, and how many carts become orders. That is the
measurement a shop is actually run on.

Two constraints shape the answer. The store is deployed on a single VPS whose whole stack is four
containers, so an analytics platform that doubles the memory footprint is not free. And the site
exists to be tested: the suite is deterministic by construction, screenshots are compared at a
1 % pixel ratio, and k6 thresholds are derived from a measured baseline. A third-party script that
fires network requests at unpredictable moments is, from the suite's point of view, a source of
flakiness with no upside.

## Options considered

1. **Umami, on the existing PostgreSQL.** The cheapest option by a distance: no new database
   engine, ~150 MB of memory, a 2 KB tracker. It counts page views and custom events well. It has
   no e-commerce model — no product view, no cart update, no order with its lines and totals — so
   the funnel would have to be rebuilt out of generic events, and the reports read as a pile of
   event names rather than as a funnel.

2. **Plausible CE.** A better product than its size suggests, but it brings ClickHouse *and*
   PostgreSQL, around 1 GB of memory, for one small site. E-commerce support exists in the paid
   tiers, not in the community edition.

3. **Server-side only, importing the Caddy access log.** No JavaScript, no cookie, no consent
   banner, and — the tempting part — literally zero impact on the test suite. It also cannot see
   anything the browser does: no cart update, no order value, no distinction between a bot and a
   customer beyond the user agent. The funnel is precisely the part a log cannot reconstruct.

4. **Matomo, self-hosted, with its own MariaDB.** The heaviest of the four: a second database
   engine, PHP, a few hundred megabytes. It is also the only one with a first-class e-commerce
   model — `setEcommerceView`, `trackEcommerceCartUpdate`, `trackEcommerceOrder` with lines, tax,
   shipping and discount — which is the thing being bought.

## Decision

Option 4. Matomo in the same Compose stack, behind Caddy on a dedicated subdomain, with its own
MariaDB volume. Three consequences were decided along with it.

**Cookieless.** The tracker calls `disableCookies` before anything else, and the server anonymises
IP addresses. Together, these are what exempts the measurement from a consent banner — and a
banner is not a neutral addition here: it is a UI component, a persisted state, and a modal that
every single UI spec would have to dismiss before it can touch the page. Repeat visitors are
counted less precisely. That is the cost.

**A dedicated subdomain, not a path.** Matomo is a full PHP application that rewrites its own URLs
and sets session cookies on the root. Mounting it under `/analytics` would mean rewriting its links
one by one, and the first one missed is a blank page.

**The tracker is absent whenever `E2E_TEST_MODE=1`,** guarded in the root layout with the same
discriminant that hides the test endpoints (`lib/deployment.ts`) — not `NODE_ENV`, which reads
"production" in the suite exactly as it does on a server. The guard is server-side on purpose: the
tag is then missing from the HTML rather than merely inert, so no request is ever started. The
suite additionally aborts requests to `matomo.js` and `matomo.php` at the browser context. The
redundancy is the point: if the guard ever regresses, the specs must not quietly start depending on
a reachable third-party host, because that failure would present itself as network flakiness rather
than as the regression it is. `REQ-SEC-16` / `TC-425` watches the guard itself, in the served HTML,
which is the only place its disappearance is visible.

## Consequences

- A second database engine to back up, and a second set of credentials. `docs/deployment.md`
  carries both.
- `NEXT_PUBLIC_MATOMO_URL` and `NEXT_PUBLIC_MATOMO_SITE_ID` are substituted at build time, not read
  at runtime — the same trap as `NEXT_PUBLIC_SEED_BUGS`. Changing either requires rebuilding the
  image, and the site id only exists after Matomo's guided install has run, so first deployment is
  a two-step affair. Both are documented where they are declared.
- Leaving both variables empty disables the tracker entirely and renders nothing. That is the
  default, and it is what a developer workstation and the CI build both get.
- The e-commerce calls convert cents to decimal currency units at one single boundary
  (`lib/analytics.ts`). Every amount in the repository is an integer number of cents; an order of
  1 299,00 € recorded as 129 900 € is the kind of error nobody notices until the reports are read
  weeks later.
