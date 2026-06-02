#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${1:-/home/pi/nexus-kiosk}"

# Print banner
echo "=== VRSI Dashboard Uninstaller ==="
echo ""

# Warn user
echo -e "${RED}This will stop and remove the VRSI Dashboard from this system.${NC}"
echo ""

# Ask for confirmation
read -p "$(echo -e ${YELLOW}Type yes to continue:${NC} )" -r confirmation
if [ "$confirmation" != "yes" ]; then
    exit 0
fi

echo ""

# Stop and disable systemd units
echo -e "${YELLOW}Stopping systemd units...${NC}"
sudo systemctl stop dashboard-kiosk.service || true
sudo systemctl disable dashboard-kiosk.service || true
sudo systemctl stop dashboard-backend.service || true
sudo systemctl disable dashboard-backend.service || true
sudo systemctl stop nexus-kiosk-updater.timer || true
sudo systemctl disable nexus-kiosk-updater.timer || true
sudo systemctl stop nexus-kiosk-updater.service || true
sudo systemctl disable nexus-kiosk-updater.service || true

echo -e "${GREEN}Units stopped and disabled.${NC}"
echo ""

# Remove systemd unit files
echo -e "${YELLOW}Removing systemd unit files...${NC}"
sudo rm -f /etc/systemd/system/dashboard-backend.service
sudo rm -f /etc/systemd/system/dashboard-kiosk.service
sudo rm -f /etc/systemd/system/nexus-kiosk-updater.service
sudo rm -f /etc/systemd/system/nexus-kiosk-updater.timer

echo -e "${GREEN}Systemd unit files removed.${NC}"
echo ""

# Reload systemd
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}Systemd daemon reloaded.${NC}"
echo ""

# Remove log directory
echo -e "${YELLOW}Removing log directory...${NC}"
sudo rm -rf /var/log/nexus-kiosk
echo -e "${GREEN}Log directory removed.${NC}"
echo ""

# Handle nexus-kiosk command symlink
if [ -L /usr/local/bin/nexus-kiosk ]; then
    read -p "$(echo -e ${YELLOW}Remove nexus-kiosk command? \(yes/no\):${NC} )" -r remove_cmd
    if [ "$remove_cmd" = "yes" ]; then
        sudo rm -f /usr/local/bin/nexus-kiosk
        echo -e "${GREEN}nexus-kiosk command removed.${NC}"
    fi
fi
echo ""

# Handle application files
read -p "$(echo -e ${YELLOW}Remove application files at $INSTALL_DIR? \(yes/no\):${NC} )" -r remove_app
if [ "$remove_app" = "yes" ]; then
    read -p "$(echo -e ${RED}Type DELETE to confirm permanent deletion:${NC} )" -r confirm_delete
    if [ "$confirm_delete" = "DELETE" ]; then
        sudo rm -rf "$INSTALL_DIR"
        echo -e "${GREEN}Application files removed.${NC}"
    else
        echo -e "${YELLOW}Deletion cancelled.${NC}"
    fi
fi
echo ""

# Print completion banner
echo "=== VRSI Dashboard has been uninstalled ==="
