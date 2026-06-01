#!/bin/bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/home/pi/nexus-kiosk}"

cd "$INSTALL_DIR"

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] auto-update start (branch: $BRANCH)"

BEFORE=$(git rev-parse HEAD)

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo "No new commits, skipping rebuild"
    exit 0
fi

echo "Changes found: $BEFORE -> $AFTER"

npm install
npm run build

sudo systemctl restart dashboard-backend.service

echo "Update complete. Backend restarted."
