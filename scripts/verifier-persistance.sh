#!/usr/bin/env bash
# Checks REQ-DATA-05: data survives a full shutdown.
#
#   CI=true ./scripts/verifier-persistance.sh http://localhost
#   ./scripts/verifier-persistance.sh http://localhost --jaccepte
#
# Places an order, stops the whole stack, starts it again, and reads the order
# back. It is the only check in the repository the Playwright suite cannot
# carry: it cannot restart the server it is talking to. It therefore runs
# against the real artefacts, which incidentally makes it more convincing than a
# test that would have run in memory.
#
# WARNING — this script writes an order, consumes stock and interrupts the
# service. It belongs in CI or on a freshly set-up deployment, never on a shop
# that is running. Hence the safeguard below.
set -euo pipefail

BASE_URL="${1:-}"
CONSENTEMENT="${2:-}"
COMPOSE="${COMPOSE:-docker compose}"

if [[ -z "$BASE_URL" ]]; then
  echo "usage: [CI=true] $0 <base-url> [--jaccepte]" >&2
  exit 64
fi
BASE_URL="${BASE_URL%/}"

if [[ "${CI:-}" != "true" && "$CONSENTEMENT" != "--jaccepte" ]]; then
  cat >&2 <<'FIN'
This script stops the stack and writes a test order.
On a live deployment, that is not what you want.

  ./scripts/verifier-persistance.sh <url> --jaccepte
FIN
  exit 65
fi

# Node rather than jq: this is a Node project, jq is not.
extraire() { node -pe "const d=JSON.parse(require('fs').readFileSync(0));$1"; }

attendre() {
  for _ in $(seq 1 60); do
    curl -sf --max-time 5 "${BASE_URL}/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "  The stack did not respond." >&2
  return 1
}

echo "Persistence — ${BASE_URL}"
attendre

# -------------------------------------------------------------- before shutdown

lecture=$(curl -sS "${BASE_URL}/api/products?limit=100")
produit=$(printf '%s' "$lecture" | extraire "
  const p=d.items.find(i=>i.stock>=4);
  if(!p) throw new Error('no product with enough stock');
  [p.id,p.slug,p.stock].join(' ')")
read -r PID SLUG STOCK_AVANT <<< "$produit"

panier=$(curl -sS -X POST "${BASE_URL}/api/cart/items" -H 'content-type: application/json' \
  -d "{\"productId\":\"${PID}\",\"quantity\":2}")
CART=$(printf '%s' "$panier" | extraire 'd.id')

commande=$(curl -sS -X POST "${BASE_URL}/api/orders" \
  -H 'content-type: application/json' -H "x-cart-id: ${CART}" -d '{
    "email":"persistance@fretline.test","paymentMethod":"carte","acceptTerms":true,
    "shippingAddress":{"firstName":"Test","lastName":"Persistance","line1":"1 rue de la Base",
      "postalCode":"75001","city":"Paris","country":"France","phone":"0601020304"}
  }')

REF=$(printf '%s' "$commande" | extraire 'd.reference')
JETON=$(printf '%s' "$commande" | extraire 'd.accessToken')
TOTAL=$(printf '%s' "$commande" | extraire 'd.totals.total')
TVA=$(printf '%s' "$commande" | extraire 'd.totals.vat')
LIGNES=$(printf '%s' "$commande" | extraire 'd.items.length')

STOCK_APRES=$(curl -sS "${BASE_URL}/api/products/${SLUG}" | extraire 'd.stock')

printf '  order %s — %s line(s), total %s c, VAT %s c\n' "$REF" "$LIGNES" "$TOTAL" "$TVA"
printf '  stock %s: %s → %s\n' "$SLUG" "$STOCK_AVANT" "$STOCK_APRES"

if [[ "$STOCK_APRES" != "$((STOCK_AVANT - 2))" ]]; then
  echo "  FAIL  stock was not decremented even before the shutdown." >&2
  exit 1
fi

# ---------------------------------------------------------------------- restart

echo
echo "  stopping the stack…"
# Without `--volumes`: that is the whole point of the check. A `down -v` here
# would turn the test green on a database recreated from scratch, which proves
# nothing.
$COMPOSE down >/dev/null 2>&1
echo "  starting again…"
$COMPOSE up -d >/dev/null 2>&1
attendre
echo "  the stack responds again."
echo

# --------------------------------------------------------------- after shutdown

relue=$(curl -sS "${BASE_URL}/api/orders/${REF}" -H "x-order-token: ${JETON}")
echecs=0

comparer() {
  local libelle="$1" attendu="$2" obtenu="$3"
  if [[ "$attendu" == "$obtenu" ]]; then
    printf '  ok    %-34s %s\n' "$libelle" "$obtenu"
  else
    printf '  FAIL  %-34s %s (expected %s)\n' "$libelle" "$obtenu" "$attendu"
    echecs=$((echecs + 1))
  fi
}

comparer 'reference'       "$REF"          "$(printf '%s' "$relue" | extraire 'd.reference ?? "absente"')"
comparer 'number of lines' "$LIGNES"       "$(printf '%s' "$relue" | extraire 'd.items?.length ?? 0')"
comparer 'total'           "$TOTAL"        "$(printf '%s' "$relue" | extraire 'd.totals?.total ?? 0')"
comparer 'VAT'             "$TVA"          "$(printf '%s' "$relue" | extraire 'd.totals?.vat ?? 0')"
comparer 'delivery city'   'Paris'         "$(printf '%s' "$relue" | extraire 'd.shippingAddress?.city ?? "?"')"
comparer 'stock preserved' "$STOCK_APRES"  "$(curl -sS "${BASE_URL}/api/products/${SLUG}" | extraire 'd.stock')"

echo
if (( echecs > 0 )); then
  echo "$echecs check(s) failed — the data did not survive." >&2
  exit 1
fi
echo 'The data survived a full shutdown.'
