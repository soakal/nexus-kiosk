#!/bin/bash
# Run ON the target Linux kiosk host (console or SSH), not from Windows.
# Example:
#   curl -fsSL .../bootstrap-on-linux.sh | bash
# Or copy this file to the machine and: sudo bash bootstrap-on-linux.sh
#
# Optional env:
#   KIOSK_USER=vrsi          login user (default: user running sudo)
#   INSTALL_DIR=/home/vrsi/nexus-kiosk
#   KIOSK_URL=http://192.168.200.60:3001   CORS + browser URL
#   SKIP_IMPORT=1            skip spreadsheet curl import (default for clean slate)
#   VM_AUTO_IMPORT=1         opt in to auto-import when XLSM is present
#   XLSM=/path/to/file.xlsm  spreadsheet on this machine

set -euo pipefail

KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-$(whoami)}}"
INSTALL_DIR="${INSTALL_DIR:-/home/${KIOSK_USER}/nexus-kiosk}"
PORT="${PORT:-3001}"
KIOSK_URL="${KIOSK_URL:-http://127.0.0.1:${PORT}}"
XLSM="${XLSM:-}"
SKIP_IMPORT="${SKIP_IMPORT:-1}"

echo "=== Nexus Kiosk bootstrap ==="
echo "User:        ${KIOSK_USER}"
echo "Install dir: ${INSTALL_DIR}"
echo "Kiosk URL:   ${KIOSK_URL}"

curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh -o /tmp/nexus-kiosk-install-linux.sh
chmod +x /tmp/nexus-kiosk-install-linux.sh
sudo env NON_INTERACTIVE=1 INSTALL_DIR="${INSTALL_DIR}" KIOSK_USER="${KIOSK_USER}" bash /tmp/nexus-kiosk-install-linux.sh
rm -f /tmp/nexus-kiosk-install-linux.sh

ENV_FILE="${INSTALL_DIR}/.env"
if [ -f "${ENV_FILE}" ]; then
  grep -q '^DISABLE_AZURE=' "${ENV_FILE}" \
    && sed -i 's|^DISABLE_AZURE=.*|DISABLE_AZURE=true|' "${ENV_FILE}" \
    || echo 'DISABLE_AZURE=true' >> "${ENV_FILE}"
  grep -q '^CORS_ORIGIN=' "${ENV_FILE}" \
    && sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${KIOSK_URL}|" "${ENV_FILE}" \
    || echo "CORS_ORIGIN=${KIOSK_URL}" >> "${ENV_FILE}"
  sudo systemctl restart dashboard-backend 2>/dev/null || true
  sudo systemctl restart dashboard-kiosk 2>/dev/null || true
  sleep 5
fi

curl -sf "http://localhost:${PORT}/health" | python3 -m json.tool || true

if [ "${SKIP_IMPORT}" = "1" ]; then
  echo "SKIP_IMPORT=1 — use Projects -> Import in the browser."
elif [ -n "${XLSM}" ] && [ -f "${XLSM}" ]; then
  echo "=== Spreadsheet import ==="
  curl -sf -F "file=@${XLSM}" "http://localhost:${PORT}/api/board/import" | python3 -m json.tool
else
  echo "No XLSM on this host — open ${KIOSK_URL} and use Projects -> Import."
fi

echo "=== Done ==="
echo "Open ${KIOSK_URL}/board/users and pick your name."
