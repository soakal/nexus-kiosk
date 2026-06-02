#!/bin/bash
set -euo pipefail

# Resolve the X authority cookie. The systemd unit hardcodes
# XAUTHORITY=/home/<user>/.Xauthority, which is correct for Raspberry Pi OS /
# Debian lightdm autologin. On other setups lightdm stores the cookie elsewhere
# (e.g. /var/run/lightdm/<user>/xauthority or /run/user/<uid>/...), so fall back
# to auto-detection to avoid Chromium failing with "cannot open display :0".
if [ -z "${XAUTHORITY:-}" ] || [ ! -f "${XAUTHORITY:-}" ]; then
    DETECTED_XAUTH=$(find /var/run/lightdm /run/user /run/lightdm \
        \( -name 'xauthority' -o -name 'Xauthority' -o -name '*.xauth' \) \
        2>/dev/null | head -1)
    if [ -n "$DETECTED_XAUTH" ]; then
        export XAUTHORITY="$DETECTED_XAUTH"
        echo "XAUTHORITY auto-detected at $XAUTHORITY"
    else
        echo "Warning: could not locate an X authority file; using XAUTHORITY=${XAUTHORITY:-<unset>}"
    fi
fi

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
READY=0

echo "Waiting for backend to be ready..."
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo "Backend is ready!"
        READY=1
        break
    fi
    echo "Backend not ready, retrying in ${RETRY_SLEEP}s... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep $RETRY_SLEEP
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $READY -ne 1 ]; then
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
