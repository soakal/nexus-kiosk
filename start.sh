#!/bin/bash
set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Print starting message in green
echo -e "${GREEN}Starting VRSI Dashboard...${NC}"

# Check if dashboard-backend.service exists
if ! systemctl list-unit-files dashboard-backend.service 2>/dev/null | grep -q dashboard-backend; then
    echo -e "${RED}Error: The app is not installed. Run deploy/install-linux.sh first.${NC}"
    exit 1
fi

# Start the backend service
sudo systemctl start dashboard-backend.service

# Wait for backend to start
sleep 3

# Start the kiosk service
sudo systemctl start dashboard-kiosk.service

# Print status of both services
sudo systemctl is-active dashboard-backend.service dashboard-kiosk.service

# Print success message in green
echo -e "${GREEN}VRSI Dashboard is running.${NC}"

# Print log command
echo "View logs: sudo journalctl -u dashboard-backend -f"
