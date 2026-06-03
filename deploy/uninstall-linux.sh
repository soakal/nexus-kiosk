#!/bin/bash
#
# Nexus Kiosk — full uninstall (services, app tree, logs, backups, runtime data)
# ------------------------------------------------------------------
# Non-interactive (recommended for scripts / clean slate):
#
#   NON_INTERACTIVE=1 sudo bash deploy/uninstall-linux.sh
#
# With explicit install dir:
#
#   NON_INTERACTIVE=1 INSTALL_DIR=/home/vrsi/nexus-kiosk sudo bash deploy/uninstall-linux.sh
#
# Interactive (prompts before deleting files):
#
#   sudo bash deploy/uninstall-linux.sh [/path/to/nexus-kiosk]
# ------------------------------------------------------------------

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}$*${NC}"; }
step()  { echo -e "${YELLOW}$*${NC}"; }
warn()  { echo -e "${YELLOW}$*${NC}"; }
err()   { echo -e "${RED}$*${NC}" >&2; }

default_user() {
    if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
        echo "$SUDO_USER"
    elif [ -n "${USER:-}" ] && [ "${USER}" != "root" ]; then
        echo "$USER"
    else
        local guess
        guess=$(getent passwd 1000 2>/dev/null | cut -d: -f1 || true)
        echo "${guess:-pi}"
    fi
}

as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

KIOSK_USER="${KIOSK_USER:-$(default_user)}"
DEFAULT_DIR="/home/${KIOSK_USER}/nexus-kiosk"
INSTALL_DIR="${INSTALL_DIR:-${1:-$DEFAULT_DIR}}"

echo "=== Nexus Kiosk Uninstaller ==="
echo ""
echo "Install directory: ${INSTALL_DIR}"
echo ""

if [ "${NON_INTERACTIVE:-}" != "1" ]; then
    err "This removes the app, all board data (jobs, notes, status), .env, tokens, logs, and backups."
    echo ""
    read -r -p "$(echo -e "${YELLOW}Type yes to continue:${NC} ")" confirmation
    if [ "$confirmation" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo ""
    read -r -p "$(echo -e "${RED}Type DELETE to confirm permanent deletion of ${INSTALL_DIR}:${NC} ")" confirm_delete
    if [ "$confirm_delete" != "DELETE" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo ""
else
    step "Non-interactive mode: removing everything under ${INSTALL_DIR}"
fi

step "Stopping services..."
for unit in \
    dashboard-kiosk.service \
    dashboard-backend.service \
    nexus-kiosk-updater.timer \
    nexus-kiosk-backup.timer \
    nexus-kiosk-updater.service \
    nexus-kiosk-backup.service
do
    as_root systemctl stop "$unit" 2>/dev/null || true
    as_root systemctl disable "$unit" 2>/dev/null || true
done

step "Freeing port 3001..."
as_root fuser -k 3001/tcp 2>/dev/null || true

step "Removing systemd units..."
for unit in \
    dashboard-backend.service \
    dashboard-kiosk.service \
    nexus-kiosk-updater.service \
    nexus-kiosk-updater.timer \
    nexus-kiosk-backup.service \
    nexus-kiosk-backup.timer
do
    as_root rm -f "/etc/systemd/system/${unit}"
done
as_root systemctl daemon-reload
as_root systemctl reset-failed 2>/dev/null || true

step "Removing application and all runtime data at ${INSTALL_DIR}..."
as_root rm -rf "${INSTALL_DIR}"

step "Removing logs..."
as_root rm -rf /var/log/nexus-kiosk

step "Removing all Nexus Kiosk backups..."
as_root rm -rf /var/backups/nexus-kiosk
as_root rm -f /var/backups/nexus-kiosk-* 2>/dev/null || true
as_root rm -rf /var/backups/nexus-kiosk-* 2>/dev/null || true

step "Removing CLI helper and kiosk display drop-in..."
as_root rm -f /usr/local/bin/nexus-kiosk
as_root rm -f /etc/lightdm/lightdm.conf.d/50-nexus-kiosk.conf

echo ""
step "Verification"
if [ ! -d "${INSTALL_DIR}" ]; then
    log "OK: ${INSTALL_DIR} removed"
else
    err "FAIL: ${INSTALL_DIR} still exists"
fi
if [ ! -d /var/log/nexus-kiosk ]; then
    log "OK: logs removed"
else
    err "FAIL: logs remain"
fi
if [ ! -d /var/backups/nexus-kiosk ]; then
    log "OK: backup dir removed"
else
    err "FAIL: backups remain"
fi
if curl -sf --connect-timeout 2 http://localhost:3001/health >/dev/null 2>&1; then
    warn "WARN: something still responds on port 3001"
else
    log "OK: nothing on port 3001"
fi
if systemctl is-active dashboard-backend.service >/dev/null 2>&1; then
    warn "WARN: dashboard-backend still active"
else
    log "OK: dashboard-backend inactive"
fi

echo ""
log "=== Uninstall complete — clean slate (no app, no board data, no backups) ==="
log "Reinstall: curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash"
log "Then import jobs manually via Projects -> Import (fresh install does not restore spreadsheet data)."
