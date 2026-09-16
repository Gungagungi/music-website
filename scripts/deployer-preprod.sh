#!/usr/bin/env bash
# Deploys a branch to pre-production, replacing the previous one.
#
#   npm run preprod:deploy -- <branch>
#   ./scripts/deployer-preprod.sh <branch>
#
# The branch is read from `origin`, not from this checkout: what gets deployed is
# what was pushed, and a locally modified file does not sneak in.
#
# The database is reset on every deployment. A pre-production that keeps the
# previous branch's data tests the migration of a database production will never
# have — and its seed data, replayed on a populated database, is not replayed at
# all (`bootstrap` skips seeding a database that is already loaded).
set -euo pipefail

DEPOT=$(cd "$(dirname "$0")/.." && pwd)
# Hard-coded, and passed explicitly to every Compose command: the file's `name:`
# belongs to the deployed branch. A branch that changed it to `fretline` would
# point the `down --volumes` below at the production database.
PROJET=fretline-preprod
WORKTREE=${PREPROD_WORKTREE:-$HOME/.local/share/fretline-preprod/worktree}
ENV_PREPROD="$DEPOT/.env.preprod"
ENV_PRODUCTION="$DEPOT/.env.production"

branche=${1:-}
if [ -z "$branche" ]; then
  echo "Usage: $0 <branch>   (e.g. $0 feature/avis-clients)" >&2
  exit 2
fi

if [ ! -f "$ENV_PREPROD" ]; then
  echo "$ENV_PREPROD missing. Create it: npm run preprod:env" >&2
  exit 1
fi

# The network is created by the production stack. Without it, pre-production
# would start behind no proxy at all: a "successful" deployment nobody can open.
if ! docker network inspect fretline-edge >/dev/null 2>&1; then
  echo "Network fretline-edge missing: the production stack must be started with" >&2
  echo "the docker-compose.yml that declares it (docker compose --env-file .env.production up -d caddy)." >&2
  exit 1
fi

echo "→ fetching origin/$branche"
git -C "$DEPOT" fetch --prune origin
if ! git -C "$DEPOT" rev-parse --verify --quiet "origin/$branche^{commit}" >/dev/null; then
  echo "Branch not found on origin: $branche" >&2
  exit 1
fi

# A dedicated worktree, never this checkout: the build reads the context as it is
# on disk, and work in progress would end up in the image without anyone meaning
# it to. Same rule as the CI self-healing agent.
if [ -e "$WORKTREE/.git" ]; then
  git -C "$WORKTREE" checkout --quiet --detach --force "origin/$branche"
  git -C "$WORKTREE" clean --quiet -fdx
else
  mkdir -p "$(dirname "$WORKTREE")"
  git -C "$DEPOT" worktree add --quiet --detach "$WORKTREE" "origin/$branche"
fi
revision=$(git -C "$WORKTREE" log -1 --format='%h %s')
echo "  $revision"

# The branch's compose file if it has one — it is tested along with it —,
# otherwise this checkout's: a branch that predates pre-production has none.
COMPOSE_FILE="$WORKTREE/docker-compose.preprod.yml"
[ -f "$COMPOSE_FILE" ] || COMPOSE_FILE="$DEPOT/docker-compose.preprod.yml"

compose() {
  docker compose -p "$PROJET" -f "$COMPOSE_FILE" --project-directory "$WORKTREE" \
    --env-file "$ENV_PREPROD" "$@"
}

echo "→ stopping the previous pre-production and resetting its database"
compose down --volumes --remove-orphans

# The build is not capped, unlike the containers: it runs inside the Docker
# daemon, out of reach of a `cpus:`. It therefore competes with the shop for CPU
# for a few minutes — do not deploy during a k6 measurement.
echo "→ build and start"
compose up -d --build --wait

echo "→ checking"
# From inside the container: this check depends on neither the domain nor access.
sante=$(compose exec -T app wget -qO- http://127.0.0.1:3000/api/health)
if ! grep -q '"testMode":true' <<<"$sante"; then
  echo "  FAIL  /api/health does not confirm testMode:true: $sante" >&2
  exit 1
fi
echo '  ok    /api/health confirms testMode:true'

# Then through Caddy, with the suite's key if it is configured: that is the path
# the browser and Playwright will actually take.
lire_production() {
  [ -f "$ENV_PRODUCTION" ] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_PRODUCTION" | tail -n1 | tr -d "'\""
}
domaine=$(lire_production FRETLINE_PREPROD_DOMAIN)
cle=$(lire_production PREPROD_ACCESS_KEY)
if [ -n "$domaine" ]; then url="https://$domaine"; else url="http://127.0.0.1:${FRETLINE_PREPROD_PORT:-8083}"; fi

if [ -n "$cle" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "x-fretline-preprod: $cle" "$url/api/health" || true)
  if [ "$code" != 200 ]; then
    echo "  FAIL  $url/api/health answers $code through Caddy" >&2
    exit 1
  fi
  echo "  ok    $url answers through Caddy"
else
  echo "  --    PREPROD_ACCESS_KEY missing from .env.production: check through Caddy skipped"
fi

# Only dangling images — the old `fretline-app:preprod` this build has just
# replaced. Disk is this server's scarcest resource, and every deployment leaves
# one behind.
docker image prune -f >/dev/null

echo
echo "Pre-production deployed: $revision"
echo "  $url"
