#!/usr/bin/env bash
# Compressed MongoDB dump of the whole `aimag` database, with simple rotation.
#   ./scripts/backup-mongo.sh [backup_dir] [keep_count]
# Cron (daily 03:15):  15 3 * * * cd /opt/synthwire && ./scripts/backup-mongo.sh >> backups/backup.log 2>&1
# Override how compose is invoked with COMPOSE="docker compose -p myproject --env-file /path/.env".
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${1:-backups}"
KEEP="${2:-14}"
COMPOSE="${COMPOSE:-docker compose}"
mkdir -p "$DIR"
FILE="$DIR/aimag-$(date -u +%Y%m%d-%H%M%S).archive.gz"

$COMPOSE exec -T mongo mongodump --quiet --db aimag --archive --gzip > "$FILE.partial"
# A dump that is suspiciously small means something went wrong: refuse to keep it as a "good" backup.
if [ "$(wc -c < "$FILE.partial")" -lt 200 ]; then
  rm -f "$FILE.partial"
  echo "backup failed: dump is empty" >&2
  exit 1
fi
mv "$FILE.partial" "$FILE"
echo "$(date -u +%FT%TZ) wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Keep only the newest $KEEP backups.
ls -1t "$DIR"/aimag-*.archive.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f --
