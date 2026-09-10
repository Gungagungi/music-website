#!/usr/bin/env bash
# Déploie une branche sur la pré-production, à la place de la précédente.
#
#   npm run preprod:deploy -- <branche>
#   ./scripts/deployer-preprod.sh <branche>
#
# La branche est lue sur `origin`, pas dans ce checkout : ce qui est déployé est
# ce qui a été poussé, et un fichier modifié localement ne s'y glisse pas.
#
# La base est remise à zéro à chaque déploiement. Une pré-prod qui garde les
# données de la branche précédente teste la migration d'une base que la
# production n'aura jamais — et ses graines, rejouées sur une base peuplée, ne
# sont pas rejouées du tout (`bootstrap` saute le seed d'une base déjà chargée).
set -euo pipefail

DEPOT=$(cd "$(dirname "$0")/.." && pwd)
# Écrit en dur, et passé explicitement à chaque commande Compose : le `name:` du
# fichier appartient à la branche déployée. Une branche qui le changerait en
# `fretline` ferait viser au `down --volumes` ci-dessous la base de production.
PROJET=fretline-preprod
WORKTREE=${PREPROD_WORKTREE:-$HOME/.local/share/fretline-preprod/worktree}
ENV_PREPROD="$DEPOT/.env.preprod"
ENV_PRODUCTION="$DEPOT/.env.production"

branche=${1:-}
if [ -z "$branche" ]; then
  echo "Usage : $0 <branche>   (ex. : $0 feature/avis-clients)" >&2
  exit 2
fi

if [ ! -f "$ENV_PREPROD" ]; then
  echo "$ENV_PREPROD absent. Le créer : npm run preprod:env" >&2
  exit 1
fi

# Le réseau est créé par la pile de production. Sans lui, la pré-prod démarrerait
# derrière aucun proxy : un déploiement « réussi » que personne ne peut ouvrir.
if ! docker network inspect fretline-edge >/dev/null 2>&1; then
  echo "Réseau fretline-edge absent : la pile de production doit être démarrée avec" >&2
  echo "le docker-compose.yml qui le déclare (docker compose --env-file .env.production up -d caddy)." >&2
  exit 1
fi

echo "→ récupération de origin/$branche"
git -C "$DEPOT" fetch --prune origin
if ! git -C "$DEPOT" rev-parse --verify --quiet "origin/$branche^{commit}" >/dev/null; then
  echo "Branche introuvable sur origin : $branche" >&2
  exit 1
fi

# Un worktree dédié, jamais ce checkout : le build lit le contexte tel qu'il est
# sur disque, et un travail en cours se retrouverait dans l'image sans qu'on l'ait
# voulu. Même règle que l'agent d'autoréparation CI.
if [ -e "$WORKTREE/.git" ]; then
  git -C "$WORKTREE" checkout --quiet --detach --force "origin/$branche"
  git -C "$WORKTREE" clean --quiet -fdx
else
  mkdir -p "$(dirname "$WORKTREE")"
  git -C "$DEPOT" worktree add --quiet --detach "$WORKTREE" "origin/$branche"
fi
revision=$(git -C "$WORKTREE" log -1 --format='%h %s')
echo "  $revision"

# Le compose de la branche s'il existe — il est éprouvé avec elle —, sinon celui
# de ce checkout : une branche partie avant la pré-prod n'en a pas.
COMPOSE_FILE="$WORKTREE/docker-compose.preprod.yml"
[ -f "$COMPOSE_FILE" ] || COMPOSE_FILE="$DEPOT/docker-compose.preprod.yml"

compose() {
  docker compose -p "$PROJET" -f "$COMPOSE_FILE" --project-directory "$WORKTREE" \
    --env-file "$ENV_PREPROD" "$@"
}

echo "→ arrêt de la pré-prod précédente et remise à zéro de sa base"
compose down --volumes --remove-orphans

# Le build n'est pas plafonné, contrairement aux conteneurs : il s'exécute dans
# le démon Docker, hors de portée d'un `cpus:`. Il dispute donc le CPU à la
# boutique pendant quelques minutes — ne pas déployer pendant une mesure k6.
echo "→ build et démarrage"
compose up -d --build --wait

echo "→ vérification"
# Depuis le conteneur : ce contrôle ne dépend ni du domaine, ni de l'accès.
sante=$(compose exec -T app wget -qO- http://127.0.0.1:3000/api/health)
if ! grep -q '"testMode":true' <<<"$sante"; then
  echo "  ÉCHEC /api/health ne confirme pas testMode:true : $sante" >&2
  exit 1
fi
echo '  ok    /api/health confirme testMode:true'

# Puis à travers Caddy, avec la clé de la suite si elle est configurée : c'est le
# chemin qu'emprunteront réellement le navigateur et Playwright.
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
    echo "  ÉCHEC $url/api/health répond $code à travers Caddy" >&2
    exit 1
  fi
  echo "  ok    $url répond à travers Caddy"
else
  echo "  --    PREPROD_ACCESS_KEY absente de .env.production : contrôle à travers Caddy ignoré"
fi

# Seulement les images orphelines — l'ancienne `fretline-app:preprod` que ce
# build vient de détrôner. Le disque de ce serveur est la ressource la plus
# courte, et chaque déploiement en laisse une.
docker image prune -f >/dev/null

echo
echo "Pré-prod déployée : $revision"
echo "  $url"
