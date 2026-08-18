# Deployment

Fretline runs on a single VPS behind Docker Compose: PostgreSQL, the application, Caddy for
TLS, and a small loop that applies the cart retention policy. The store is a demo, but the
deployment is not a demo of a deployment — everything below is what actually gates a release.

## Prerequisites

- A host with Docker Engine and the Compose plugin (`docker compose version` ≥ 2).
- A DNS record pointing at the host, if you want HTTPS. Caddy obtains and renews the
  certificate itself; nothing else is needed.
- Ports 80 and 443 reachable. Let's Encrypt validates over 80 even when you only serve 443.

## First deployment

```bash
git clone https://github.com/Gungagungi/music-website.git
cd music-website

cp .env.production.example .env
$EDITOR .env          # FRETLINE_DOMAIN, POSTGRES_PASSWORD, AUTH_SECRET

docker compose up -d --build
./scripts/verifier-deploiement.sh https://your-domain
```

The three variables have no defaults and the stack refuses to start without them. That is
deliberate: a silent default for a database password or a signing key is worse than no
default, because it works.

Generate `POSTGRES_PASSWORD` with `openssl rand -hex 32`, not `-base64`. It is interpolated
into `DATABASE_URL`, and base64's `/` terminates a URL's authority section: the driver reads
a truncated host and fails with `Invalid URL`, redacting the input as it goes, so the error
names nothing. Roughly two generated passwords in five hit it. `prod:env` produces URL-safe
values and refuses a hand-written one that is not.

`AUTH_SECRET` in particular is enforced twice. Compose refuses to interpolate it if it is
empty, and the application refuses to start if it is absent *or* still set to the demo value
checked into this repository — that value is public, so anyone could mint a session for any
account with it. Generate one with `openssl rand -base64 48`.

## Trying the stack on a workstation

A development machine already has a `.env` — the one `npm run db:setup` writes for the test
suite. Compose reads that same file, so pointing the production stack at it means either
clobbering the development one or watching interpolation fail on a variable that has no
business being there.

`--env-file` replaces the default without touching it, and the `prod:*` scripts wrap that:

```bash
npm run prod:env -- --domain=:80   # .env.production: password and key generated, HTTP only
npm run prod:up                    # build + up, through --env-file .env.production
./scripts/verifier-deploiement.sh http://localhost

npm run prod:logs
npm run prod:down                  # or prod:nuke to drop the volumes too
```

`--domain` is the one value the script will not invent. A password and a signing key are pure
secrets with no human decision behind them; a domain is a decision, and defaulting it to `:80`
would mean a server quietly serving plain HTTP because somebody skipped a step. Omit it and
the script exits non-zero with the command to run — which is why `prod:up` stops there instead
of handing you a Compose interpolation error.

Nothing is ever overwritten: a variable that already has a value survives any number of runs,
`--domain` included.

If ports 80 or 443 are taken locally, set `FRETLINE_HTTP_PORT` / `FRETLINE_HTTPS_PORT`.
"The port was busy" is a poor reason not to exercise a stack before deploying it.

On a server, none of this applies: the file is `.env` and the command is plain
`docker compose`.

## What happens on `up`

| Service | Role |
| --- | --- |
| `db` | PostgreSQL 17, named volume, no published port — only the compose network reaches it |
| `migrate` | One-shot. Applies migrations, then seeds the catalogue **only if the database has never been loaded**. The app waits for it to exit successfully |
| `app` | Next.js standalone server, not exposed to the host |
| `purge` | Applies the cart retention policy on a loop |
| `caddy` | TLS termination and reverse proxy, the only service bound to host ports |

Migrations run in `migrate`, not at application startup. Both work today with one container;
only one of them still works the day there are two, and the day there are two nobody
re-reads the entrypoint.

The seed is conditional for the same class of reason. `db:seed` is unconditional and
idempotent, which is right for a test database and wrong for a live one: re-running it would
resurrect every product an operator had deleted, at every restart, and nobody would connect
the two events.

## Updating

```bash
git pull
docker compose up -d --build
./scripts/verifier-deploiement.sh https://your-domain
```

`migrate` runs again and reports `base déjà peuplée : seed ignoré`. New migrations apply;
the catalogue is left alone.

## The post-deployment check

`scripts/verifier-deploiement.sh` is not decoration. `/api/test/{reset,seed,state}` truncate
and rewrite the database, and nothing in the interface signals that they are open. One stray
environment variable is enough, and you find out afterwards.

Three details in that script are worth knowing, because each was a check that looked fine
and verified nothing:

- **Each route is probed with its own method.** `GET /api/test/reset` returns 405 — Next
  rejects the method before the handler runs — and 405 says nothing about the guard. You get
  the same answer from a wide-open server.
- **No `x-test-token` is sent**, which is what makes the probe safe: the second guard refuses
  the request even in test mode, so nothing can be wiped. A correct deployment answers 404;
  a 401 or 403 fails the check while telling you exactly what is wrong.
- **`/api/health` is read separately** for `testMode:false`, so the conclusion does not rest
  on HTTP status codes alone.

CI runs the same script against the same artifacts (`deploiement` job in `ci.yml`): it
builds the image, brings the whole stack up, and fails if any of it regresses. The
Dockerfile, the compose file and the Caddyfile are exercised on every push rather than on
the evening you deploy.

## Backups

```bash
./scripts/sauvegarde.sh                 # → ./sauvegardes/fretline-<timestamp>.dump
```

In cron, nightly:

```cron
30 3 * * * cd /srv/fretline && ./scripts/sauvegarde.sh >> /var/log/fretline-sauvegarde.log 2>&1
```

`pg_dump` goes through `docker compose exec`, not over the network — the database publishes
no port, which is the point. The dump is written to a `.partiel` file and renamed on success,
so an interrupted backup never leaves behind a truncated file that looks valid and that you
will be counting on the one day you need it.

Restore:

```bash
docker compose exec -T db pg_restore --clean --if-exists --no-owner \
  --username fretline --dbname fretline < sauvegardes/fretline-....dump
```

A backup nobody has restored is a hypothesis. Restore one into a scratch database before you
need to.

## Cart retention

The `purge` service runs `node app/dist/db/purge.mjs` every `PURGE_INTERVAL_SECONDS`
(default: one day). The windows themselves are in `app/src/lib/retention.ts`:

| Cart | Kept for |
| --- | --- |
| Empty, no account | 24 hours |
| Guest, with items | 30 days |
| Attached to an account | Exempt from both, swept after a year of dormancy |

Retention follows reachability. A guest cart is reachable only through a cookie that expires
in 30 days, so keeping the row longer keeps something nobody can reach. A cart attached to an
account is reachable at every sign-in — "your cart is waiting" is a feature, not litter — so
the only reason to delete it is data protection, and a year is the scale of that argument
rather than of housekeeping.

A loop rather than `pg_cron`: the extension is not shipped with the official Postgres image
and would mean a custom image plus `shared_preload_libraries`, for a job that has nothing
specific to the database about it. A loop in the existing application image reads in three
lines, restarts with everything else, and runs exactly the code the suite tests.

## Notes

**No `pg_dump` of `drizzle.__drizzle_migrations` needed separately** — it is an ordinary
table and travels with the dump. A restored database is at the schema version it was dumped
at, and `migrate` takes it from there.

**The image ships no `reset` command.** `db:reset` truncates every table; it exists for
development and is deliberately left out of `scripts/build-db-cli.mjs`, so it is not a loaded
gun one `docker compose run` away.

**Connection pooling** is `pg.Pool`, sized by `DATABASE_POOL_MAX` (default 10). PgBouncer only
becomes useful if the application scales past one container.

**Reverse proxy choice.** Caddy over Traefik: automatic HTTPS in three lines and no Docker
socket exposed to the proxy. Traefik's dynamic discovery pays off from roughly ten services
onward, and this is five.
