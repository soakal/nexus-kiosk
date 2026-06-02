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

# Verify backend came up; retry up to 3 times if port was still held
verify_backend() {
    local attempt=0
    while [ $attempt -lt 3 ]; do
        sleep 4
        if systemctl is-active --quiet dashboard-backend.service 2>/dev/null; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend running ✓"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend not active (attempt $attempt/3) — killing port 3001 and retrying..."
        sudo fuser -k 3001/tcp 2>/dev/null || true
        sleep 1
        sudo systemctl restart dashboard-backend.service
    done
    # Final check
    sleep 4
    if systemctl is-active --quiet dashboard-backend.service 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend running ✓"
        return 0
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backend failed to start after 3 attempts." >&2
    echo "--- Last 30 journal lines ---" >&2
    journalctl -u dashboard-backend.service -n 30 --no-pager 2>/dev/null || true
    return 1
}
verify_backend

echo "Update complete. Services restarted."
