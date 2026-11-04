#!/usr/bin/env bash
# Restore a dump made by backup-mongo.sh. DESTRUCTIVE: replaces the contents of the `aimag` database.
#   ./scripts/restore-mongo.sh backups/aimag-20261104-031500.archive.gz
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: restore-mongo.sh <backup.archive.gz>}"
COMPOSE="${COMPOSE:-docker compose}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }

echo "This will REPLACE the 'aimag' database with $FILE."
read -r -p "Type 'restore' to continue: " answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

$COMPOSE exec -T mongo mongorestore --quiet --drop --gzip --archive < "$FILE"
echo "restored $FILE. Restart the api so caches and indexes are rebuilt:  $COMPOSE restart api"
