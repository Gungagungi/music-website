#!/usr/bin/env bash
# Database backup, to be run from the repository root on the server.
#
#   ./scripts/sauvegarde.sh [directory]        # default: ./sauvegardes
#
# In cron, once a night:
#   30 3 * * * cd /srv/fretline && ./scripts/sauvegarde.sh >> /var/log/fretline-sauvegarde.log 2>&1
#
# `pg_dump` goes through `docker compose exec`, not the network: the database
# publishes no port, which is the point. The `custom` format (-Fc) is compressed
# and allows selective restoration, table by table, with pg_restore.
set -euo pipefail

DESTINATION="${1:-./sauvegardes}"
RETENTION_JOURS="${RETENTION_JOURS:-14}"

mkdir -p "$DESTINATION"
horodatage=$(date -u +%Y%m%dT%H%M%SZ)
fichier="${DESTINATION}/fretline-${horodatage}.dump"

# Write to a temporary file first: an interrupted backup must not leave behind
# a truncated file that looks valid and that someone will count on the day it is
# needed.
docker compose exec -T db \
  pg_dump --format=custom --no-owner \
    --username "${POSTGRES_USER:-fretline}" \
    "${POSTGRES_DB:-fretline}" > "${fichier}.partiel"

mv "${fichier}.partiel" "$fichier"
echo "backup: $fichier ($(du -h "$fichier" | cut -f1))"

# Rotation. `-mtime +N` counts in whole days, so +14 deletes what is fifteen
# days old or more.
supprimes=$(find "$DESTINATION" -name 'fretline-*.dump' -mtime "+${RETENTION_JOURS}" -print -delete | wc -l)
(( supprimes > 0 )) && echo "rotation: $supprimes backup(s) older than ${RETENTION_JOURS} days deleted"

# Restoration:
#   docker compose exec -T db pg_restore --clean --if-exists --no-owner \
#     --username fretline --dbname fretline < sauvegardes/fretline-....dump
exit 0
