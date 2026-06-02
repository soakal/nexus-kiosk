#!/bin/bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/home/pi/nexus-kiosk}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Fail gracefully (skip this unattended run) if there is no checkout to update.
[ -d "$INSTALL_DIR/.git" ] || { echo "[$(date '+%F %T')] No git checkout at $INSTALL_DIR — auto-update skipped" >&2; exit 0; }
cd "$INSTALL_DIR" || { echo "[$(date '+%F %T')] cannot cd to $INSTALL_DIR — auto-update skipped" >&2; exit 1; }

# Connectivity pre-check. When offline, skip this run (exit 0) rather than
# failing destructively — the timer will try again next week. Finite timeouts
# (curl --connect-timeout/--max-time) avoid hanging at 03:30.
check_network_connectivity() {
    local h
    for h in github.com registry.npmjs.org; do
        if ! curl -fsS --connect-timeout 5 --max-time 10 -o /dev/null "https://$h" 2>/dev/null \
           && ! curl -fsSI --connect-timeout 5 --max-time 10 -o /dev/null "https://$h" 2>/dev/null; then
            echo "[$(date '+%F %T')] $h unreachable — skipping this auto-update run" >&2
            exit 0
        fi
    done
}
check_network_connectivity

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] auto-update start (branch: $BRANCH)"

BEFORE=$(git rev-parse HEAD)

# Back up board data before updating
if [ -f "$INSTALL_DIR/deploy/backup.sh" ]; then
    log "Creating pre-update backup..."
    bash "$INSTALL_DIR/deploy/backup.sh" || log "WARNING: pre-update backup failed (continuing)"
fi

# Back up runtime state before any destructive git operation. board/config JSON
# is normally untracked (survives reset --hard), but this is a safety net in case
# it ever becomes tracked or a stale local commit exists.
BACKUP_DIR="/var/backups/nexus-kiosk-$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR" 2>/dev/null || true
cp -f server/data/*.json "$BACKUP_DIR/" 2>/dev/null || true
cp -f data/*.json "$BACKUP_DIR/" 2>/dev/null || true
echo "Runtime state backed up to $BACKUP_DIR"

# Finite git timeout so a stalled transfer aborts instead of hanging at 03:30.
GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=20 \
    git fetch origin "$BRANCH" \
    || { echo "[$(date '+%F %T')] git fetch failed — skipping this auto-update run" >&2; exit 0; }
git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1 \
    || { echo "[$(date '+%F %T')] origin/$BRANCH not available after fetch — skipping" >&2; exit 0; }
git reset --hard "origin/$BRANCH" \
    || { echo "[$(date '+%F %T')] git reset failed — skipping this auto-update run" >&2; exit 1; }

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo "No new commits, skipping rebuild"
    exit 0
fi

echo "Changes found: $BEFORE -> $AFTER"

# Wipe node_modules to defend against stale/cross-platform copies (matches installer).
# Connectivity was verified up front, so npm install should be reachable.
rm -rf node_modules server/node_modules client/node_modules
npm install \
    || { echo "[$(date '+%F %T')] npm install failed — node_modules wiped; backend may be down until next run/manual fix" >&2; exit 1; }
# Ensure every workspace .bin shim is executable (tsc, vite, tsx, etc.).
find "$INSTALL_DIR" -path "*/node_modules/.bin/*" -exec chmod +x {} \; 2>/dev/null || true
npm run build \
    || { echo "[$(date '+%F %T')] npm run build failed — see output above" >&2; exit 1; }

# Re-install service file so any changes (e.g. NODE_ENV, paths) take effect
KIOSK_USER="${KIOSK_USER:-$(stat -c '%U' "$INSTALL_DIR" 2>/dev/null || echo pi)}"
sed -e "s|INSTALL_DIR|$INSTALL_DIR|g" -e "s|KIOSK_USER|$KIOSK_USER|g" \
    "$INSTALL_DIR/deploy/dashboard-backend.service" \
    | sudo tee /etc/systemd/system/dashboard-backend.service > /dev/null
sudo systemctl daemon-reload
echo "Service file updated"

# Verify client/dist exists before starting — rebuild if missing
if [ ! -f "$INSTALL_DIR/client/dist/index.html" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] client/dist/index.html missing — rebuilding client..."
    npm run build
fi

# Try graceful stop first, fall back to force-kill
sudo systemctl stop dashboard-backend.service 2>/dev/null || true
sleep 2
if fuser 3001/tcp >/dev/null 2>&1; then
  fuser -k 3001/tcp 2>/dev/null || true
  sleep 1
fi
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

log "Waiting for backend to be fully ready..."
READY=false
for i in $(seq 1 12); do
  if curl -sf http://localhost:3001/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ready') or d.get('authenticated') or d.get('testMode') or d.get('needsReauth') else 1)" 2>/dev/null; then
    READY=true
    break
  fi
  log "  Readiness check $i/12 — not ready yet, waiting 5s..."
  sleep 5
done
if [ "$READY" = "false" ]; then
  log "WARNING: Backend did not become ready within 60s — check logs:"
  journalctl -u dashboard-backend.service -n 30 --no-pager 2>/dev/null || true
else
  log "Backend is ready"
fi

# Verify the SPA is being served (not a 404 JSON response for /board)
sleep 2
BOARD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/board 2>/dev/null || echo "000")
if [ "$BOARD_RESPONSE" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SPA route /board responding ✓"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: /board returned HTTP $BOARD_RESPONSE — client/dist may be missing. Rebuilding..."
    npm run build
    sudo fuser -k 3001/tcp 2>/dev/null || true
    sudo systemctl restart dashboard-backend.service
    sleep 4
fi

echo "Update complete. Services restarted."
