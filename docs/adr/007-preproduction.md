# ADR-007 — A pre-production slot on the production host

**Status**: Accepted · **Date**: 2026-09 · **Scope**: deployment, test environments

## Context

A branch could only be tried on a workstation — a MacBook Air M1 — which means a local
PostgreSQL, a local build, and an ARM machine standing in for an x86 server. What the branch does
once it is an image behind Caddy, on the host that actually serves the store, was only ever
discovered after merging.

The host is small: 2 vCPU, 3.7 GiB of memory with roughly half available, a disk at 84 %. The
store's measured breaking point is CPU saturation of the Node event loop, not the database pool.
Whatever runs next to it must not be able to push it there.

## Options considered

1. **A second VPS.** Complete isolation, and a monthly bill plus a second machine to patch,
   audit and back up. For a single developer deploying a branch a few times a week, the machine
   would sit idle almost all of the time.

2. **One environment per pull request.** `pr-42.preprod…`, created on open and destroyed on
   close. The right shape for a team; here, each open PR costs ~300 MB that the host does not
   have, and nothing bounds how many are open.

3. **One slot on the production host, deployed by hand.** A separate Compose project behind the
   existing Caddy. A deployment replaces whatever was there, and its database with it.

## Decision

Option 3. `docker-compose.preprod.yml` defines the project `fretline-preprod` — PostgreSQL, the
one-shot `migrate`, the application — and `scripts/deployer-preprod.sh <branch>` builds it from
`origin/<branch>` in a dedicated worktree.

- **The production Caddy serves it**, over a Docker network named `fretline-edge` that only Caddy
  joins on the production side. Ports 80 and 443 are taken and the certificates live there; a
  second proxy would own neither. The production database is not on that network.
- **Test mode is on** (`E2E_TEST_MODE=1`), so the Playwright suite can run against it. That also
  removes the Matomo tracker, so the store's analytics never see test traffic.
- **The database is reset on every deployment** (`down --volumes`). Keeping it would test a
  migration from a state production never reaches, and `bootstrap` skips the seed on a populated
  database, so the seeds would silently not apply.
- **The application is capped** (`cpus: 0.75`, `mem_limit: 512m`), so the pre-production
  saturates before the store does.

## Access

Basic auth on the pre-production host, plus an exemption for requests that carry
`x-fretline-preprod: <PREPROD_ACCESS_KEY>`. The exemption is not a convenience: basic auth uses
the `Authorization` header, and the API suite already puts its `Bearer` token there. The two
cannot share one request.

Two traps were found while building it, and both would have taken the store down rather than the
pre-production:

- **Caddy applies a `{$VAR:default}` only when the variable is unset, not when it is empty**, and
  Compose passes an empty variable. An empty domain or an empty hash makes Caddy reject its whole
  configuration. The defaults therefore live in `docker-compose.yml` (`${VAR:-…}`), where an empty
  value does fall back.
- **The default password hash is locked, not empty**: the bcrypt hash of a random string that was
  thrown away. With nothing configured — CI, a workstation — Caddy starts and the pre-production
  answers 401 to everyone. The key exemption uses an expression that requires a non-empty header,
  so an unset key never matches an absent one.

## Costs accepted

- **Shared hardware.** The build runs inside the Docker daemon, which a Compose `cpus:` cannot
  reach: for a few minutes a deployment competes with the store for CPU. Deploying during a k6
  measurement would skew it.
- **One branch at a time.** Two people — or two branches — take turns.
- **The image tag is a trap.** Production builds `fretline-app:latest`. A pre-production build
  under the same tag would be picked up by the next production `up`, with no rebuild and no
  warning; the pre-production uses `fretline-app:preprod`.
- **The pre-production depends on production being up**: no `fretline-edge` network, no proxy.
  The deployment script checks it and refuses to go on.
