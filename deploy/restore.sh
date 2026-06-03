#!/bin/bash
# Nexus Kiosk — Board data restore
# Usage: restore.sh [list | <archive-path> | latest]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(dirname "$SCRIPT_DIR")}"
DATA_DIR="$INSTALL_DIR/server/data"
BACKUP_DIR="/var/backups/nexus-kiosk"
SERVICE="dashboard-backend.service"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*"; exit 1; }

if [ $# -eq 0 ] || [ "${1:-}" = "list" ]; then
  log "Available backups:"
  ls -lht "$BACKUP_DIR"/board-*.tar.gz 2>/dev/null | awk '{print $5, $6, $7, $8, $9}' || log "(none found)"
  exit 0
fi

CHOSEN="${1:-}"
[ "$CHOSEN" = "latest" ] && CHOSEN=$(ls -1t "$BACKUP_DIR"/board-*.tar.gz 2>/dev/null | head -1)
[ -z "$CHOSEN" ] && die "No backups found"
[ -f "$CHOSEN" ] || { [ -f "$BACKUP_DIR/$CHOSEN" ] && CHOSEN="$BACKUP_DIR/$CHOSEN"; } || die "Archive not found: $CHOSEN"

log "Restoring from: $CHOSEN"
tar -tzf "$CHOSEN" >/dev/null 2>&1 || die "Archive is corrupt"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
tar -xzf "$CHOSEN" -C "$STAGE"

for f in jobs.json board-state.json board-config.json; do
  [ -f "$STAGE/$f" ] || continue
  python3 -c "import json; json.load(open('$STAGE/$f'))" 2>/dev/null || die "$f failed JSON validation"
done

log "Stopping backend..."
systemctl stop "$SERVICE" 2>/dev/null || true
sleep 2

TS=$(date +%Y-%m-%d-%H%M)
PRE="$BACKUP_DIR/pre-restore-$TS.tar.gz"
ls "$DATA_DIR"/*.json >/dev/null 2>&1 && tar -czf "$PRE" -C "$DATA_DIR" . && log "Pre-restore snapshot: $PRE"

for f in jobs.json board-state.json board-config.json; do
  [ -f "$STAGE/$f" ] && cp -f "$STAGE/$f" "$DATA_DIR/$f" && chmod 600 "$DATA_DIR/$f" && log "Restored: $f"
done

log "Starting backend..."
systemctl start "$SERVICE"
sleep 3
curl -sf http://localhost:3001/health >/dev/null 2>&1 && log "Restore complete — backend responding" || log "WARNING: backend not responding — check: journalctl -u $SERVICE -n 30"
