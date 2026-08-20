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

# Attente bornée avant de commencer.
#
# Lancé juste après `docker compose up -d`, le script tirait dans une pile en
# cours de démarrage : conteneurs qui n'écoutent pas encore, certificat pas
# encore obtenu. Huit échecs qui ne disent rien de la conformité du déploiement —
# le pire résultat possible pour une vérification, puisqu'il ressemble à une
# vraie alerte. Bornée, en revanche : au-delà, l'absence de réponse *est* le
# résultat.
attendre_la_pile() {
  local limite="${ATTENTE_MAX:-60}" ecoule=0

  until curl -sS -o /dev/null --max-time 5 "${BASE_URL}/api/health" 2>/dev/null; do
    if (( ecoule >= limite )); then
      echo "  Aucune réponse de ${BASE_URL} après ${limite} s." >&2
      echo "  Journaux : docker compose --env-file .env.production logs --tail=50" >&2
      return 1
    fi
    sleep 2
    ecoule=$((ecoule + 2))
  done

  (( ecoule > 0 )) && echo "  (la pile a répondu après ${ecoule} s)"
  return 0
}

verifier() {
  local libelle="$1" chemin="$2" attendu="$3" methode="${4:-GET}"
  local obtenu
  # `-w` écrit déjà 000 quand la requête n'aboutit pas ; le `|| echo 000` d'avant
  # en ajoutait un second, et le rapport affichait un « 000000 » qui n'existe pas.
  obtenu=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -X "$methode" "${BASE_URL}${chemin}" 2>/dev/null || true)
  obtenu=${obtenu:-000}

  if [[ "$obtenu" == "$attendu" ]]; then
    printf '  ok    %-46s %s\n' "$libelle" "$obtenu"
  else
    printf '  ÉCHEC %-46s %s (attendu %s)\n' "$libelle" "$obtenu" "$attendu"
    echecs=$((echecs + 1))
  fi
}

echo "Vérification de ${BASE_URL}"

attendre_la_pile || exit 1

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
verifier "endpoint de test /purge injoignable" /api/test/purge  404 POST
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

# Mesure d'audience, seulement si l'instance est censée exister. Un déploiement
# sans Matomo est un déploiement valide : la variable absente n'est pas un échec.
#
# 200 ou 302 : tant que l'installation guidée n'a pas été faite, Matomo redirige
# vers son installateur. Exiger 200 ferait échouer la vérification précisément au
# moment où l'on vient de déployer et où l'on a le plus besoin qu'elle soit
# lisible.
if [[ -n "${ANALYTICS_URL:-}" ]]; then
  echo
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${ANALYTICS_URL%/}/" 2>/dev/null || true)
  if [[ "${code:-000}" == 200 || "${code:-000}" == 302 ]]; then
    printf '  ok    %-46s %s\n' 'interface Matomo joignable' "$code"
  else
    printf '  ÉCHEC %-46s %s (attendu 200 ou 302)\n' 'interface Matomo joignable' "${code:-000}"
    echecs=$((echecs + 1))
  fi
fi

echo
if (( echecs > 0 )); then
  echo "$echecs vérification(s) en échec." >&2
  exit 1
fi
echo 'Déploiement conforme.'
