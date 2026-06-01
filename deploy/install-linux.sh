#!/bin/bash
set -euo pipefail

# Color output for readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Nexus Kiosk Linux Installation ===${NC}"
echo ""

# Step 1: Prompt for installation parameters
echo -e "${YELLOW}Step 1: Configuration${NC}"

# BLOCK A — Non-interactive mode
# If NON_INTERACTIVE=1 is set, use env vars and skip all prompts.
if [ "${NON_INTERACTIVE:-}" = "1" ]; then
    INSTALL_DIR="${INSTALL_DIR:-/home/$USER/nexus-kiosk}"
    KIOSK_USER="${KIOSK_USER:-$USER}"
    echo "Non-interactive mode: using provided environment variables"
else
    read -p "Enter installation directory (default: /home/$USER/nexus-kiosk): " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-/home/$USER/nexus-kiosk}

    read -p "Enter kiosk user (default: $USER): " KIOSK_USER
    KIOSK_USER=${KIOSK_USER:-$USER}
fi

echo "Installation directory: $INSTALL_DIR"
echo "Kiosk user: $KIOSK_USER"
echo ""

# Step 2: Install Node.js if needed
echo -e "${YELLOW}Step 2: Checking Node.js${NC}"
NODE_INSTALLED=false
NODE_VERSION=0

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "Node.js $(node -v) is already installed"
        NODE_INSTALLED=true
    else
        echo "Node.js version $NODE_VERSION is too old (need >= 18)"
    fi
else
    echo "Node.js not found"
fi

if [ "$NODE_INSTALLED" = false ]; then
    echo "Installing Node.js 20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js installed: $(node -v)"
fi
echo ""

# Step 3: Install system dependencies
echo -e "${YELLOW}Step 3: Installing system dependencies${NC}"
sudo apt-get update
sudo apt-get install -y chromium-browser unclutter curl || \
    sudo apt-get install -y chromium unclutter curl
echo "System dependencies installed"
echo ""

# Step 4: Create installation directory and install npm dependencies
echo -e "${YELLOW}Step 4: Installing npm dependencies${NC}"
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating installation directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
echo "Installing npm packages in $INSTALL_DIR..."
npm install

# Fix execute permissions on bin scripts (required when files were copied from Windows)
find "$INSTALL_DIR" -path "*/node_modules/.bin/*" -exec chmod +x {} \; 2>/dev/null || true

# Ensure we're in the right directory for build
if [ -f "package.json" ]; then
    echo "Building project..."
    npm run build
else
    echo -e "${RED}Error: package.json not found in $INSTALL_DIR${NC}"
    exit 1
fi
echo ""

# Step 5: Setup environment file
echo -e "${YELLOW}Step 5: Setting up environment file${NC}"
if [ ! -f "$INSTALL_DIR/.env" ]; then
    if [ -f "$INSTALL_DIR/.env.example" ]; then
        echo "Creating .env from .env.example..."
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"

        # Generate encryption secret
        ENCRYPTION_SECRET=$(openssl rand -base64 32)

        # Replace ENCRYPTION_SECRET in .env (handle different formats)
        if grep -q "ENCRYPTION_SECRET=" "$INSTALL_DIR/.env"; then
            sed -i "s|ENCRYPTION_SECRET=.*|ENCRYPTION_SECRET=$ENCRYPTION_SECRET|" "$INSTALL_DIR/.env"
        else
            echo "ENCRYPTION_SECRET=$ENCRYPTION_SECRET" >> "$INSTALL_DIR/.env"
        fi

        # Ensure NODE_ENV=production for deployed installs
        if grep -q "NODE_ENV=" "$INSTALL_DIR/.env"; then
            sed -i "s|NODE_ENV=.*|NODE_ENV=production|" "$INSTALL_DIR/.env"
        else
            echo "NODE_ENV=production" >> "$INSTALL_DIR/.env"
        fi

        echo "Environment file configured with encryption secret"
    else
        echo -e "${YELLOW}Warning: .env.example not found, creating minimal .env${NC}"
        cat > "$INSTALL_DIR/.env" << EOF
PORT=3001
NODE_ENV=production
ENCRYPTION_SECRET=$(openssl rand -base64 32)
EOF
    fi
else
    echo ".env file already exists, skipping creation"
fi
echo ""

# Step 6: Create logging directory
echo -e "${YELLOW}Step 6: Setting up logging${NC}"
sudo mkdir -p /var/log/nexus-kiosk
sudo chown "$KIOSK_USER:$KIOSK_USER" /var/log/nexus-kiosk
sudo chmod 755 /var/log/nexus-kiosk
echo "Logging directory configured: /var/log/nexus-kiosk"
echo ""

# Step 7: Create and install systemd service files
echo -e "${YELLOW}Step 7: Installing systemd services${NC}"

# Create temporary service file for backend
BACKEND_SERVICE=$(mktemp)
sed "s|KIOSK_USER|$KIOSK_USER|g; s|INSTALL_DIR|$INSTALL_DIR|g" "$INSTALL_DIR/deploy/dashboard-backend.service" > "$BACKEND_SERVICE"
sudo cp "$BACKEND_SERVICE" /etc/systemd/system/dashboard-backend.service
rm "$BACKEND_SERVICE"

# Create temporary service file for kiosk
KIOSK_SERVICE=$(mktemp)
sed "s|KIOSK_USER|$KIOSK_USER|g; s|INSTALL_DIR|$INSTALL_DIR|g" "$INSTALL_DIR/deploy/dashboard-kiosk.service" > "$KIOSK_SERVICE"
sudo cp "$KIOSK_SERVICE" /etc/systemd/system/dashboard-kiosk.service
rm "$KIOSK_SERVICE"

# Make start-kiosk.sh executable
sudo chmod +x "$INSTALL_DIR/deploy/start-kiosk.sh"

echo "Service files installed:"
echo "  - /etc/systemd/system/dashboard-backend.service"
echo "  - /etc/systemd/system/dashboard-kiosk.service"
echo ""

# Step 8: Reload systemd and enable services
echo -e "${YELLOW}Step 8: Enabling services${NC}"
sudo systemctl daemon-reload
sudo systemctl enable dashboard-backend.service
sudo systemctl enable dashboard-kiosk.service
echo "Services enabled and will start on boot"
echo ""

# BLOCK B — Auto-updater installation
echo -e "${YELLOW}Step 8b: Installing auto-updater${NC}"

# Install updater service (replace INSTALL_DIR placeholder)
UPDATER_SERVICE=$(mktemp)
sed "s|INSTALL_DIR|$INSTALL_DIR|g" "$INSTALL_DIR/deploy/nexus-kiosk-updater.service" > "$UPDATER_SERVICE"
sudo cp "$UPDATER_SERVICE" /etc/systemd/system/nexus-kiosk-updater.service
rm "$UPDATER_SERVICE"

# Install updater timer (no placeholders needed)
sudo cp "$INSTALL_DIR/deploy/nexus-kiosk-updater.timer" /etc/systemd/system/nexus-kiosk-updater.timer

# Make the auto-update script executable
chmod +x "$INSTALL_DIR/deploy/auto-update.sh"

sudo systemctl daemon-reload
sudo systemctl enable --now nexus-kiosk-updater.timer

echo "Auto-update scheduled: every Sunday at 3:30 AM"
echo "  - /etc/systemd/system/nexus-kiosk-updater.service"
echo "  - /etc/systemd/system/nexus-kiosk-updater.timer"
echo ""

# BLOCK C — One-command startup symlink
echo -e "${YELLOW}Step 8c: Creating nexus-kiosk command${NC}"
chmod +x "$INSTALL_DIR/start.sh"
sudo ln -sf "$INSTALL_DIR/start.sh" /usr/local/bin/nexus-kiosk
echo "Type nexus-kiosk from anywhere to start the dashboard"
echo ""

# Step 9: Configure lightdm autologin (if available)
echo -e "${YELLOW}Step 9: Configuring autologin${NC}"
LIGHTDM_CONF="/etc/lightdm/lightdm.conf"
if [ -f "$LIGHTDM_CONF" ]; then
    echo "Configuring lightdm for autologin as $KIOSK_USER..."
    if grep -q "^autologin-user=" "$LIGHTDM_CONF"; then
        sudo sed -i "s/^autologin-user=.*/autologin-user=$KIOSK_USER/" "$LIGHTDM_CONF"
    else
        sudo sed -i "/^\[Seat:\*\]/a autologin-user=$KIOSK_USER" "$LIGHTDM_CONF"
    fi

    if grep -q "^autologin-user-timeout=" "$LIGHTDM_CONF"; then
        sudo sed -i "s/^autologin-user-timeout=.*/autologin-user-timeout=0/" "$LIGHTDM_CONF"
    else
        sudo sed -i "/^autologin-user=/a autologin-user-timeout=0" "$LIGHTDM_CONF"
    fi

    echo "lightdm configured"
else
    echo -e "${YELLOW}lightdm.conf not found, skipping autologin configuration${NC}"
    echo "To enable autologin manually, edit /etc/lightdm/lightdm.conf and add:"
    echo "  autologin-user=$KIOSK_USER"
    echo "  autologin-user-timeout=0"
fi
echo ""

# Step 10: Final instructions
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo "Installation directory: $INSTALL_DIR"
echo "Kiosk user: $KIOSK_USER"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review and update $INSTALL_DIR/.env as needed"
echo "2. Start the services:"
echo "   sudo systemctl start dashboard-backend.service"
echo "   sudo systemctl start dashboard-kiosk.service"
echo "3. Check service status:"
echo "   sudo systemctl status dashboard-backend.service"
echo "   sudo systemctl status dashboard-kiosk.service"
echo "4. View logs:"
echo "   sudo tail -f /var/log/nexus-kiosk/backend.log"
echo "   sudo journalctl -u dashboard-kiosk.service -f"
echo "5. Reboot to test autologin and auto-start:"
echo "   sudo reboot"
echo ""
echo -e "${GREEN}For more information, see the deployment documentation.${NC}"
