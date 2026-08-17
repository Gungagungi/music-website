#!/usr/bin/env bash
# Sauvegarde de la base, à lancer depuis la racine du dépôt sur le serveur.
#
#   ./scripts/sauvegarde.sh [répertoire]        # défaut : ./sauvegardes
#
# En cron, une fois par nuit :
#   30 3 * * * cd /srv/fretline && ./scripts/sauvegarde.sh >> /var/log/fretline-sauvegarde.log 2>&1
#
# `pg_dump` passe par `docker compose exec`, pas par le réseau : la base ne
# publie aucun port, ce qui est le point. Le format `custom` (-Fc) est compressé
# et permet une restauration sélective, table par table, avec pg_restore.
set -euo pipefail

DESTINATION="${1:-./sauvegardes}"
RETENTION_JOURS="${RETENTION_JOURS:-14}"

mkdir -p "$DESTINATION"
horodatage=$(date -u +%Y%m%dT%H%M%SZ)
fichier="${DESTINATION}/fretline-${horodatage}.dump"

# Écriture dans un fichier temporaire d'abord : une sauvegarde interrompue ne
# doit pas laisser derrière elle un fichier tronqué qui a l'air valide et sur
# lequel on comptera le jour où on en a besoin.
docker compose exec -T db \
  pg_dump --format=custom --no-owner \
    --username "${POSTGRES_USER:-fretline}" \
    "${POSTGRES_DB:-fretline}" > "${fichier}.partiel"

mv "${fichier}.partiel" "$fichier"
echo "sauvegarde : $fichier ($(du -h "$fichier" | cut -f1))"

# Rotation. `-mtime +N` compte en jours révolus, donc +14 supprime ce qui a
# quinze jours ou plus.
supprimes=$(find "$DESTINATION" -name 'fretline-*.dump' -mtime "+${RETENTION_JOURS}" -print -delete | wc -l)
(( supprimes > 0 )) && echo "rotation : $supprimes sauvegarde(s) de plus de ${RETENTION_JOURS} jours supprimée(s)"

# Restauration :
#   docker compose exec -T db pg_restore --clean --if-exists --no-owner \
#     --username fretline --dbname fretline < sauvegardes/fretline-....dump
exit 0
