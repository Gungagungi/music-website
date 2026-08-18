#!/usr/bin/env bash
# Vérifie REQ-DATA-05 : les données survivent à un arrêt complet.
#
#   CI=true ./scripts/verifier-persistance.sh http://localhost
#   ./scripts/verifier-persistance.sh http://localhost --jaccepte
#
# Passe une commande, arrête toute la pile, la relance, et relit la commande.
# C'est la seule vérification du dépôt que la suite Playwright ne peut pas
# porter : elle ne peut pas redémarrer le serveur auquel elle parle. Elle
# s'exécute donc contre les artefacts réels, ce qui la rend au passage plus
# probante qu'un test qui aurait tourné en mémoire.
#
# ATTENTION — ce script écrit une commande, consomme du stock et interrompt le
# service. Sa place est en CI ou sur un déploiement fraîchement monté, jamais sur
# une boutique qui tourne. D'où le garde-fou ci-dessous.
set -euo pipefail

BASE_URL="${1:-}"
CONSENTEMENT="${2:-}"
COMPOSE="${COMPOSE:-docker compose}"

if [[ -z "$BASE_URL" ]]; then
  echo "usage : [CI=true] $0 <url-de-base> [--jaccepte]" >&2
  exit 64
fi
BASE_URL="${BASE_URL%/}"

if [[ "${CI:-}" != "true" && "$CONSENTEMENT" != "--jaccepte" ]]; then
  cat >&2 <<'FIN'
Ce script arrête la pile et écrit une commande de test.
Sur un déploiement en service, ce n'est pas ce que vous voulez.

  ./scripts/verifier-persistance.sh <url> --jaccepte
FIN
  exit 65
fi

# Node plutôt que jq : c'est un projet Node, jq ne l'est pas.
extraire() { node -pe "const d=JSON.parse(require('fs').readFileSync(0));$1"; }

attendre() {
  for _ in $(seq 1 60); do
    curl -sf --max-time 5 "${BASE_URL}/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "  La pile n'a pas répondu." >&2
  return 1
}

echo "Persistance — ${BASE_URL}"
attendre

# ---------------------------------------------------------------- avant l'arrêt

lecture=$(curl -sS "${BASE_URL}/api/products?limit=100")
produit=$(printf '%s' "$lecture" | extraire "
  const p=d.items.find(i=>i.stock>=4);
  if(!p) throw new Error('aucun produit avec assez de stock');
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

printf '  commande %s — %s ligne(s), total %s c, TVA %s c\n' "$REF" "$LIGNES" "$TOTAL" "$TVA"
printf '  stock %s : %s → %s\n' "$SLUG" "$STOCK_AVANT" "$STOCK_APRES"

if [[ "$STOCK_APRES" != "$((STOCK_AVANT - 2))" ]]; then
  echo "  ÉCHEC le stock n'a pas été décrémenté avant même l'arrêt." >&2
  exit 1
fi

# ------------------------------------------------------------------- redémarrage

echo
echo "  arrêt de la pile…"
# Sans `--volumes` : c'est tout l'objet de la vérification. Un `down -v` ici
# rendrait le test vert sur une base recréée de zéro, ce qui ne prouve rien.
$COMPOSE down >/dev/null 2>&1
echo "  relance…"
$COMPOSE up -d >/dev/null 2>&1
attendre
echo "  la pile répond à nouveau."
echo

# ---------------------------------------------------------------- après l'arrêt

relue=$(curl -sS "${BASE_URL}/api/orders/${REF}" -H "x-order-token: ${JETON}")
echecs=0

comparer() {
  local libelle="$1" attendu="$2" obtenu="$3"
  if [[ "$attendu" == "$obtenu" ]]; then
    printf '  ok    %-34s %s\n' "$libelle" "$obtenu"
  else
    printf '  ÉCHEC %-34s %s (attendu %s)\n' "$libelle" "$obtenu" "$attendu"
    echecs=$((echecs + 1))
  fi
}

comparer 'référence'      "$REF"          "$(printf '%s' "$relue" | extraire 'd.reference ?? "absente"')"
comparer 'nombre de lignes' "$LIGNES"     "$(printf '%s' "$relue" | extraire 'd.items?.length ?? 0')"
comparer 'total'          "$TOTAL"        "$(printf '%s' "$relue" | extraire 'd.totals?.total ?? 0')"
comparer 'TVA'            "$TVA"          "$(printf '%s' "$relue" | extraire 'd.totals?.vat ?? 0')"
comparer 'ville livrée'   'Paris'         "$(printf '%s' "$relue" | extraire 'd.shippingAddress?.city ?? "?"')"
comparer 'stock conservé' "$STOCK_APRES"  "$(curl -sS "${BASE_URL}/api/products/${SLUG}" | extraire 'd.stock')"

echo
if (( echecs > 0 )); then
  echo "$echecs vérification(s) en échec — les données n'ont pas survécu." >&2
  exit 1
fi
echo 'Les données ont survécu à un arrêt complet.'
