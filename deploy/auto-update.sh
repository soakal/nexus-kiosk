#!/bin/bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/home/pi/nexus-kiosk}"

cd "$INSTALL_DIR"

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] auto-update start (branch: $BRANCH)"

BEFORE=$(git rev-parse HEAD)

# Back up runtime state before any destructive git operation. board/config JSON
# is normally untracked (survives reset --hard), but this is a safety net in case
# it ever becomes tracked or a stale local commit exists.
BACKUP_DIR="/var/backups/nexus-kiosk-$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR" 2>/dev/null || true
cp -f server/data/*.json "$BACKUP_DIR/" 2>/dev/null || true
cp -f data/*.json "$BACKUP_DIR/" 2>/dev/null || true
echo "Runtime state backed up to $BACKUP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo "No new commits, skipping rebuild"
    exit 0
fi

echo "Changes found: $BEFORE -> $AFTER"

# Wipe node_modules to defend against stale/cross-platform copies (matches installer).
rm -rf node_modules server/node_modules client/node_modules
npm install
# Ensure every workspace .bin shim is executable (tsc, vite, tsx, etc.).
find "$INSTALL_DIR" -path "*/node_modules/.bin/*" -exec chmod +x {} \; 2>/dev/null || true
npm run build

sudo fuser -k 3001/tcp 2>/dev/null || true
sudo systemctl restart dashboard-backend.service
sudo systemctl restart dashboard-kiosk.service 2>/dev/null || true

echo "Update complete. Services restarted."
