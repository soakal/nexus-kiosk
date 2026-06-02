#!/bin/bash
# Nexus Kiosk — Board data backup
# Runs via nexus-kiosk-backup.timer (every 6 hours) and before each auto-update.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-NEXUS_INSTALL_DIR_PLACEHOLDER}"
DATA_DIR="$INSTALL_DIR/server/data"
BACKUP_DIR="/var/backups/nexus-kiosk"
KEEP=28

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR"

if [ ! -d "$DATA_DIR" ]; then
  log "ERROR: data directory $DATA_DIR not found"
  exit 1
fi

TS=$(date +%Y-%m-%d-%H%M)
ARCHIVE="$BACKUP_DIR/board-$TS.tar.gz"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

COPIED=0
for f in jobs.json board-state.json board-config.json; do
  if [ -f "$DATA_DIR/$f" ]; then
    cp -f "$DATA_DIR/$f" "$STAGE/$f"
    COPIED=$((COPIED + 1))
  fi
done

if [ "$COPIED" -eq 0 ]; then
  log "No data files found — nothing to back up"
  exit 0
fi

tar -czf "$ARCHIVE" -C "$STAGE" .

if ! tar -tzf "$ARCHIVE" >/dev/null 2>&1; then
  log "ERROR: archive verification failed — removing corrupt archive"
  rm -f "$ARCHIVE"
  exit 1
fi

sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
log "Backup created: $ARCHIVE ($COPIED files)"

# Prune old backups, keep newest KEEP
ls -1t "$BACKUP_DIR"/board-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r old; do
  rm -f "$old" "$old.sha256"
  log "Pruned: $old"
done
