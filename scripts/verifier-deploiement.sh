#!/usr/bin/env bash
# Vérifications post-déploiement.
#
#   ./scripts/verifier-deploiement.sh https://exemple.fr
#
# À lancer après chaque déploiement. La vérification qui compte est la dernière :
# les endpoints de test effacent et réécrivent la base, et rien dans l'interface
# ne signale qu'ils sont ouverts. Une variable d'environnement laissée traîner
# suffit, et on ne s'en aperçoit qu'après.
set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "usage : $0 <url-de-base>" >&2
  exit 64
fi
BASE_URL="${BASE_URL%/}"

echecs=0

verifier() {
  local libelle="$1" chemin="$2" attendu="$3" methode="${4:-GET}"
  local obtenu
  obtenu=$(curl -sS -o /dev/null -w '%{http_code}' -X "$methode" "${BASE_URL}${chemin}" || echo '000')

  if [[ "$obtenu" == "$attendu" ]]; then
    printf '  ok    %-46s %s\n' "$libelle" "$obtenu"
  else
    printf '  ÉCHEC %-46s %s (attendu %s)\n' "$libelle" "$obtenu" "$attendu"
    echecs=$((echecs + 1))
  fi
}

echo "Vérification de ${BASE_URL}"

verifier "page d'accueil"                    /                  200
verifier "catalogue"           /c/guitares-electriques        200
verifier "API santé"                         /api/health        200
verifier "API catalogue"                     /api/products      200

# Les trois routes de test, une par une : la garde est portée par une seule
# variable d'environnement, mais chaque route a son propre handler et rien ne
# garantit qu'elles la lisent toutes.
#
# Chacune est sollicitée avec SA méthode. Interroger /reset en GET renvoie 405 —
# Next rejette la méthode avant d'entrer dans le handler — et un 405 ne dit
# strictement rien de l'état de la garde : on obtiendrait le même sur un serveur
# grand ouvert. C'est le genre de vérification qui rassure sans rien vérifier.
#
# Aucun `x-test-token` n'est envoyé, et c'est ce qui rend l'appel sans danger : la
# seconde garde refuse la requête même en mode test, donc rien ne peut être
# effacé. Un déploiement correct répond 404 ; s'il répondait 401 ou 403, la
# vérification échouerait — en disant exactement ce qui ne va pas.
verifier "endpoint de test /reset injoignable" /api/test/reset  404 POST
verifier "endpoint de test /seed injoignable"  /api/test/seed   404 POST
verifier "endpoint de test /state injoignable" /api/test/state  404 GET

# Le mode test se voit aussi dans la réponse de /api/health, qui l'expose
# explicitement — une seconde lecture, indépendante des codes HTTP ci-dessus.
echo
if curl -sS "${BASE_URL}/api/health" | grep -q '"testMode":false'; then
  echo '  ok    /api/health confirme testMode:false'
else
  echo '  ÉCHEC /api/health ne confirme pas testMode:false'
  echecs=$((echecs + 1))
fi

echo
if (( echecs > 0 )); then
  echo "$echecs vérification(s) en échec." >&2
  exit 1
fi
echo 'Déploiement conforme.'
