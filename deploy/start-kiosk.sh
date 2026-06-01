#!/bin/bash
set -euo pipefail

# Disable screen blanking
xset s off -dpms s noblank

# Kill any existing Chromium processes
pkill -f chromium-browser || true
pkill -f chromium || true

# Remove Chromium singleton lock file
rm -f ~/.config/chromium/Singleton 2>/dev/null || true
rm -f ~/.config/chromium/SingletonLock 2>/dev/null || true

# Wait for backend to be ready with health check loop
BACKEND_URL="http://localhost:3001"
MAX_RETRIES=30
RETRY_SLEEP=3
RETRY_COUNT=0

echo "Waiting for backend to be ready..."
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    echo "Backend not ready, retrying in ${RETRY_SLEEP}s... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep $RETRY_SLEEP
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Warning: Backend failed health check after $MAX_RETRIES attempts, starting kiosk anyway..."
fi

# Start Chromium in kiosk mode
CHROMIUM_BIN="chromium-browser"
if ! command -v chromium-browser &> /dev/null; then
    echo "chromium-browser not found, trying chromium..."
    CHROMIUM_BIN="chromium"
fi

exec $CHROMIUM_BIN \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    "$BACKEND_URL"
