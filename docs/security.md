# Security

Fretline is a fictional store, but it runs on a real VPS with a real database,
real sessions and real TLS. This document records what protects it, what a
2026-08-22 audit found, and how the recurring scan works.

## Threat model

The store holds no payment data — checkout records a payment *method*, never a
card number — and no personal data beyond a name, an e-mail address and a
shipping address. The assets worth protecting are, in order:

1. **The host.** A single VPS runs the store, its PostgreSQL database, Matomo
   and the reverse proxy. Root on this machine is root on everything.
2. **Customer accounts.** Password hashes, session tokens, order history.
3. **Availability.** Break-point testing puts this deployment's ceiling between
   80 and 90 journeys per second, CPU-bound. Cheap request amplification is a
   denial-of-service vector, not a theoretical one.

Test endpoints (`/api/test/*`) are the sharpest edge in the codebase: they
truncate and reseed the database. Three guards stand in front of them, and the
recurring scan checks the outermost one from the outside.

## Audit of 2026-08-22

### Findings and resolution

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | SSH accepted password authentication. `sshd_config` said `no` at line 57, but the `Include` at line 12 pulled `50-cloud-init.conf`, which said `yes` — and in sshd the **first** value obtained wins. | `PasswordAuthentication no` in the included file; verified with `sshd -T`. |
| High | No rate limiting anywhere. `RATE_LIMITED` and its 429 were declared in the error envelope but never emitted. `POST /api/auth/login` ran a ~50-100 ms scrypt per attempt, uncapped. | Fixed-window limiter (`app/src/lib/rate-limit.ts`) on login, register, orders, reviews and coupons. |
| High | Session and cart cookies lacked `secure`. | `sessionCookieOptions()` in `app/src/lib/auth.ts`, keyed on the deployment marker rather than `NODE_ENV`. |
| High | `.env.production` was mode 0664 — `AUTH_SECRET` and both database passwords readable by any local account. | `chmod 600`. |
| Medium | CSP was `frame-ancestors 'none'` and nothing else: no `script-src`, no `default-src`, so no mitigation against script injection at all. | Full nonce-based policy with `strict-dynamic` (`app/src/proxy.ts`). |
| Medium | Cart IDOR: `getCart()` checked no ownership and `x-cart-id` is accepted in production, so a third party presenting a cart id could read, fill and **order from** someone else's cart. | Ownership check in `app/src/lib/cart-session.ts`. |
| Medium | Non-constant-time comparison of password hashes and of `x-order-token`. | `timingSafeEqual` in both places. |
| Medium | `python3 -m http.server` listening on `0.0.0.0:8123`. Blocked by nftables today; public the moment a rule is relaxed. | Reported by the recurring scan; not a repository concern. |
| Low | `/api/health` discloses `testMode`, `seededBugs`, uptime. | Kept — the disclosure is what lets the scan verify the guard from outside. |

### What was already sound

nftables with `policy drop` (only 80, 443 and the SSH port accepted), fail2ban
on sshd, `unattended-upgrades` active, zero CVEs in production dependencies,
neither database publishing a host port, Matomo bound to the loopback,
`USER node` in the runtime image, fully parameterised SQL through Drizzle — the
single `sql.raw` carries a compile-time constant — HSTS with a 308 redirect,
and the `E2E_TEST_MODE` guard verified closed on the live deployment.

## Defences in the application

**Rate limiting** (`app/src/lib/rate-limit.ts`). Fixed window, in memory,
pinned on `globalThis` for the same reason as the database pool. The limit is
per process: a second replica doubles the effective ceiling, and that is when
the counter should move out of process — not before. Caller identity comes from
`x-forwarded-for`, trustworthy only because Caddy is the sole ingress and the
app publishes no host port.

Limits are multiplied under `E2E_TEST_MODE`. The suite runs with no proxy in
front of it, so every call shares one bucket; four registrations per ten minutes
stopped it at the fifteenth test. A factor rather than a bypass keeps the code
path live on every request. The algorithm itself is covered by unit tests —
`consume()` takes its clock as a parameter — because the API suite would need a
thousand requests to see a 429.

**Content Security Policy** (`app/src/proxy.ts`). Per-request nonce. It cannot
be a static header: the document carries an inline script — the theme bootstrap,
which must run in `<head>` before first paint — and Next's hydration scripts
change every build, so neither pins to a `sha256-`. `strict-dynamic` lets
matomo.js install itself, since it is inserted by `document.createElement`, with
no host allowlist to become the usual bypass.

`style-src` keeps `'unsafe-inline'`, deliberately: React sets `style=` attributes
on elements, which only `style-src-attr` covers that way. The directive that
matters against code injection is `script-src`, and that one is strict.

The file is `proxy.ts`, not `middleware.ts` — the convention was renamed in
Next 16.

**Deployment guard** (`app/src/lib/deployment.ts`). Fail-closed: an unrecognised
environment is treated as production. The discriminant is `E2E_TEST_MODE` and
never `NODE_ENV`, because Playwright's `webServer` runs in production mode.

## The recurring scan

`scripts/audit-securite.py` — one file, no third-party Python dependencies.
`trivy` and `nuclei` are optional and detected at runtime; their absence
degrades the report rather than interrupting it.

Four families:

| Family | Covers |
| --- | --- |
| `hote` | Effective sshd config, nftables policy, unexpected TCP listeners, fail2ban, unattended-upgrades, pending security updates, permissions on `.env*` |
| `images` | Fixable HIGH/CRITICAL CVEs in every running image (trivy) |
| `depot` | Production dependency CVEs, committed secrets, demo `AUTH_SECRET` |
| `web` | Security headers, http→https redirect, test endpoints, `/api/health` flags, cookie attributes, TLS version and expiry, signature scan (nuclei) |

```bash
npm run securite:audit -- --cible https://exemple.fr   # tout
npm run securite:depot                                 # dépendances et images
npm run securite:cible https://exemple.fr              # cible publique seule
```

Exit code is 1 when any finding reaches `--seuil` (default `eleve`), which is
what turns the systemd unit red.

### Two lessons the checks themselves encode

The scan reads **effective** configuration, never the main config file. That is
not a stylistic preference: reading `/etc/ssh/sshd_config` would have concluded
that password authentication was disabled, when the included file said otherwise.

A control that cannot run must report that it did not run. `nuclei` with no
templates installed exits with an error and writes nothing to stdout — the first
version of this script rendered that as a clean scan. Silent no-ops presented as
success are the worst failure mode a monitor has, so the template directory is
now verified before the scan, and its absence is reported as a skipped check.

### Schedule

- **VPS, daily 04:00 UTC** — `scripts/systemd/audit-securite.{service,timer}`,
  all four families. After the CI-autofix agent and after the
  `unattended-upgrades` window, so the "pending updates" check judges a system
  that has already had its chance to refresh. Reports land in
  `~/.local/share/audit-securite/`, with `dernier.json` symlinked to the newest
  and anything older than 90 days pruned.

  ```bash
  sudo cp scripts/systemd/audit-securite.* /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now audit-securite.timer
  systemctl status audit-securite.service   # red = findings above threshold
  ```

  The unit runs as `debian`, not root: it needs the `docker` group for trivy and
  `sudo -n` for exactly two privileged reads, `sshd -T` and `nft list ruleset`.

- **GitHub Actions, Mondays 05:00 UTC** — `.github/workflows/securite.yml`,
  the families a runner can actually see. The host family is absent by
  necessity: no runner reaches the VPS. The `cible` job is skipped unless the
  `FRETLINE_URL` repository variable is set, because a job that passes by doing
  nothing is worse than no job.

  Weekly rather than per-PR: CVE databases move without the repository moving,
  so the useful deadline is the calendar. Dependency checks additionally run on
  PRs that touch `package-lock.json`, where the diff genuinely changes the risk.

## Operational notes

Third-party image CVEs (postgres, mariadb, matomo, caddy) are fixed by bumping
the tag and redeploying, not by changing code. They are reported but do not fail
the CI job — a check whose only remedy lies outside the repository teaches
people to ignore it.

`.env.production` must stay mode 0600. `prod:up` does not restore it.
