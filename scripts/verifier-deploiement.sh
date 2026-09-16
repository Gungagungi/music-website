#!/usr/bin/env bash
# Post-deployment checks.
#
#   ./scripts/verifier-deploiement.sh https://example.com
#
# Run after every deployment. The check that matters is the last one: the test
# endpoints wipe and rewrite the database, and nothing in the interface signals
# that they are open. A leftover environment variable is enough, and nobody
# notices until afterwards.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Without an argument, the URL is derived from FRETLINE_DOMAIN in
# .env.production rather than hard-coding http://localhost: the latter is only
# correct for a local trial (FRETLINE_DOMAIN=:80), and wrong for any real
# deployment, where Caddy serves HTTPS and redirects plain HTTP. CI keeps
# passing the URL as an argument (it generates .env.production with
# --domain=:80, so explicit and derived give the same result): this script
# remains callable both ways.
BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  if [[ ! -f .env.production ]]; then
    echo "usage: $0 <base-url>" >&2
    exit 64
  fi

  domaine=$(grep -E '^FRETLINE_DOMAIN=' .env.production | tail -n1 | cut -d= -f2-)
  if [[ -z "$domaine" ]]; then
    echo "FRETLINE_DOMAIN missing from .env.production; pass the URL as an argument." >&2
    exit 64
  elif [[ "$domaine" == :* ]]; then
    # A bare port value: local trial, Caddy serves plain HTTP.
    BASE_URL="http://localhost"
  else
    BASE_URL="https://${domaine}"
  fi

  # Same for Matomo: if the caller has not already set ANALYTICS_URL, it is read
  # from .env.production rather than leaving this check optional on a
  # deployment where the instance does exist.
  if [[ -z "${ANALYTICS_URL:-}" ]]; then
    ANALYTICS_URL=$(grep -E '^NEXT_PUBLIC_MATOMO_URL=' .env.production | tail -n1 | cut -d= -f2-)
  fi
fi
BASE_URL="${BASE_URL%/}"

echecs=0

# Bounded wait before starting.
#
# Run right after `docker compose up -d`, the script used to fire at a stack
# still starting up: containers not listening yet, certificate not obtained
# yet. Eight failures that say nothing about whether the deployment is correct —
# the worst possible outcome for a check, since it looks like a real alert.
# Bounded, however: beyond the limit, the lack of an answer *is* the result.
attendre_la_pile() {
  local limite="${ATTENTE_MAX:-60}" ecoule=0

  until curl -sS -o /dev/null --max-time 5 "${BASE_URL}/api/health" 2>/dev/null; do
    if (( ecoule >= limite )); then
      echo "  No response from ${BASE_URL} after ${limite} s." >&2
      echo "  Logs: docker compose --env-file .env.production logs --tail=50" >&2
      return 1
    fi
    sleep 2
    ecoule=$((ecoule + 2))
  done

  (( ecoule > 0 )) && echo "  (the stack answered after ${ecoule} s)"
  return 0
}

verifier() {
  local libelle="$1" chemin="$2" attendu="$3" methode="${4:-GET}"
  local obtenu
  # `-w` already writes 000 when the request does not complete; the former
  # `|| echo 000` added a second one, and the report showed a "000000" that
  # does not exist.
  obtenu=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -X "$methode" "${BASE_URL}${chemin}" 2>/dev/null || true)
  obtenu=${obtenu:-000}

  if [[ "$obtenu" == "$attendu" ]]; then
    printf '  ok    %-46s %s\n' "$libelle" "$obtenu"
  else
    printf '  FAIL  %-46s %s (expected %s)\n' "$libelle" "$obtenu" "$attendu"
    echecs=$((echecs + 1))
  fi
}

verifier_pas_de_redirection() {
  # A base URL that redirects (Caddy always sends a domain with a certificate
  # to HTTPS, or a domain has changed) makes every `verifier` fail with a 3xx
  # other than expected: a page of failures that says nothing more than "it
  # redirects". Better to say it once, with the target.
  # Command substitution, not `read < <(...)`: without a trailing newline,
  # `read` returns a non-zero status even after reading the line correctly, and
  # `set -e` stopped the script here without a single message.
  local resultat code cible
  resultat=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' \
    --max-time 10 "${BASE_URL}/api/health" 2>/dev/null || true)
  code="${resultat%% *}"
  cible="${resultat#* }"

  if [[ "$code" == 3?? && -n "$cible" ]]; then
    echo "  This base URL redirects to ${cible} — run the check against it instead." >&2
    exit 1
  fi
}

echo "Checking ${BASE_URL}"

attendre_la_pile || exit 1
verifier_pas_de_redirection

verifier "home page"                         /                  200
verifier "catalogue"           /c/guitares-electriques        200
verifier "health API"                        /api/health        200
verifier "catalogue API"                     /api/products      200

# The test routes, one by one: the guard hangs on a single environment variable,
# but each route has its own handler and nothing guarantees they all read it.
#
# Each one is called with ITS method. Querying /reset with GET returns 405 —
# Next rejects the method before entering the handler — and a 405 says
# strictly nothing about the state of the guard: a wide-open server would give
# the same. It is the kind of check that reassures without checking anything.
#
# No `x-test-token` is sent, and that is what makes the call harmless: the
# second guard refuses the request even in test mode, so nothing can be wiped.
# A correct deployment answers 404; if it answered 401 or 403, the check would
# fail — saying exactly what is wrong.
verifier "test endpoint /reset unreachable"  /api/test/reset  404 POST
verifier "test endpoint /seed unreachable"   /api/test/seed   404 POST
verifier "test endpoint /purge unreachable"  /api/test/purge  404 POST
verifier "test endpoint /state unreachable"  /api/test/state  404 GET

# Test mode also shows in the /api/health response, which exposes it
# explicitly — a second reading, independent of the HTTP codes above.
echo
if curl -sS "${BASE_URL}/api/health" | grep -q '"testMode":false'; then
  echo '  ok    /api/health confirms testMode:false'
else
  echo '  FAIL  /api/health does not confirm testMode:false'
  echecs=$((echecs + 1))
fi

# Analytics, only if the instance is supposed to exist. A deployment without
# Matomo is a valid deployment: a missing variable is not a failure.
#
# 200 or 302: until the guided installation has been completed, Matomo
# redirects to its installer. Requiring 200 would make the check fail precisely
# right after deploying, when it most needs to be readable.
if [[ -n "${ANALYTICS_URL:-}" ]]; then
  echo
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${ANALYTICS_URL%/}/" 2>/dev/null || true)
  if [[ "${code:-000}" == 200 || "${code:-000}" == 302 ]]; then
    printf '  ok    %-46s %s\n' 'Matomo interface reachable' "$code"
  else
    printf '  FAIL  %-46s %s (expected 200 or 302)\n' 'Matomo interface reachable' "${code:-000}"
    echecs=$((echecs + 1))
  fi
fi

echo
if (( echecs > 0 )); then
  echo "$echecs check(s) failed." >&2
  exit 1
fi
echo 'Deployment compliant.'
