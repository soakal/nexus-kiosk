#!/bin/bash
#
# Nexus Kiosk — streamlined Linux installer
# ------------------------------------------------------------------
# One-command install (run as root / via sudo):
#
#   curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
#
# One-command update (skip prompts, just pull + rebuild + restart):
#
#   NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
#
# Design notes:
#  * Safe to pipe into `sudo bash`: no interactive git prompts (HTTPS clone),
#    and prompts read from /dev/tty so they still work even though stdin is
#    the piped script body.
#  * Idempotent: re-running updates an existing checkout instead of failing.
#  * Defends against node_modules that were scp'd from Windows (stale paths /
#    missing +x on .bin) by wiping them before npm install.
# ------------------------------------------------------------------

set -euo pipefail

# ---- Configuration --------------------------------------------------------
REPO_URL="https://github.com/soakal/nexus-kiosk.git"
REPO_BRANCH="master"

# Color output for readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}$*${NC}"; }
step()  { echo -e "${YELLOW}$*${NC}"; }
warn()  { echo -e "${YELLOW}$*${NC}"; }
err()   { echo -e "${RED}$*${NC}" >&2; }
die()   { err "$*"; exit 1; }

# ---- Helpers --------------------------------------------------------------

# Run a command as root, whether or not we are already root.
# (When piped to `sudo bash` we are already root and `sudo` may be absent.)
as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

# Prompt the user even when the script body is on stdin (piped).
# Falls back to the default when no terminal is attached.
prompt() {
    local message="$1" default="$2" answer=""
    if [ -r /dev/tty ]; then
        read -r -p "$message" answer < /dev/tty || answer=""
    fi
    echo "${answer:-$default}"
}

# Determine the non-root user we are installing for. When invoked via sudo,
# $USER is "root"; SUDO_USER holds the human who ran it.
default_user() {
    if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
        echo "$SUDO_USER"
    elif [ -n "${USER:-}" ] && [ "${USER}" != "root" ]; then
        echo "$USER"
    else
        # Last resort: first regular login user, else "pi".
        local guess
        guess=$(getent passwd 1000 2>/dev/null | cut -d: -f1 || true)
        echo "${guess:-pi}"
    fi
}

# ===========================================================================
log "=== Nexus Kiosk Linux Installer ==="
echo ""

# ---- Step 0: Resolve install dir + user -----------------------------------
# In update mode we skip prompts entirely.
DEFAULT_USER="$(default_user)"
DEFAULT_DIR="/home/${DEFAULT_USER}/nexus-kiosk"

# When piped (curl | bash) stdin is not a terminal — auto-use defaults.
if [ ! -t 0 ] && [ "${NEXUS_UPDATE:-}" != "1" ] && [ "${NON_INTERACTIVE:-}" != "1" ]; then
    NON_INTERACTIVE=1
fi

if [ "${NEXUS_UPDATE:-}" = "1" ]; then
    step "Update mode (NEXUS_UPDATE=1): skipping prompts"
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"
    KIOSK_USER="${KIOSK_USER:-$DEFAULT_USER}"
elif [ "${NON_INTERACTIVE:-}" = "1" ]; then
    # Honor env vars, no prompts (used by automated provisioning).
    step "Non-interactive mode (NON_INTERACTIVE=1): using environment variables"
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"
    KIOSK_USER="${KIOSK_USER:-$DEFAULT_USER}"
else
    step "Step 1: Configuration"
    INSTALL_DIR="$(prompt "Enter installation directory (default: ${DEFAULT_DIR}): " "$DEFAULT_DIR")"
    KIOSK_USER="$(prompt "Enter kiosk user (default: ${DEFAULT_USER}): " "$DEFAULT_USER")"
fi

# Validate the kiosk user exists (services run as this user).
if ! id -u "$KIOSK_USER" >/dev/null 2>&1; then
    die "User '$KIOSK_USER' does not exist. Create it first or choose another user."
fi

echo "Installation directory: $INSTALL_DIR"
echo "Kiosk user:             $KIOSK_USER"
echo ""

# ===========================================================================
# UPDATE MODE — short circuit: pull + rebuild + restart, nothing else.
# ===========================================================================
if [ "${NEXUS_UPDATE:-}" = "1" ]; then
    step "Updating existing installation in $INSTALL_DIR"
    [ -d "$INSTALL_DIR/.git" ] || die "No git checkout found at $INSTALL_DIR — run a full install first."

    cd "$INSTALL_DIR"

    # Back up runtime state before the destructive reset. board/config JSON is
    # normally untracked (survives reset --hard), but this is a safety net in
    # case it ever becomes tracked or a stale local commit exists.
    BACKUP_DIR="/var/backups/nexus-kiosk-$(date +%F-%H%M)"
    as_root mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    as_root cp -f server/data/*.json "$BACKUP_DIR/" 2>/dev/null || true
    as_root cp -f data/*.json "$BACKUP_DIR/" 2>/dev/null || true
    log "Runtime state backed up to $BACKUP_DIR"

    log "Pulling latest from $REPO_BRANCH..."
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/$REPO_BRANCH"

    log "Reinstalling dependencies..."
    rm -rf node_modules server/node_modules client/node_modules
    npm install
    find "$INSTALL_DIR" -path "*/node_modules/.bin/*" -exec chmod +x {} \; 2>/dev/null || true

    log "Rebuilding..."
    npm run build

    log "Restarting services..."
    as_root fuser -k 3001/tcp 2>/dev/null || true
    as_root systemctl restart dashboard-backend.service
    as_root systemctl restart dashboard-kiosk.service 2>/dev/null || true

    log "=== Update complete ==="
    exit 0
fi

# ===========================================================================
# FULL INSTALL
# ===========================================================================

# ---- Step 2: Node.js ------------------------------------------------------
step "Step 2: Checking Node.js"
NODE_OK=false
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "Node.js $(node -v) already installed"
        NODE_OK=true
    else
        echo "Node.js $(node -v) is too old (need >= 18)"
    fi
else
    echo "Node.js not found"
fi

if [ "$NODE_OK" = false ]; then
    echo "Installing Node.js 20 via NodeSource..."
    if [ "$(id -u)" -eq 0 ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    fi
    as_root apt-get install -y nodejs
    echo "Node.js installed: $(node -v)"
fi
echo ""

# ---- Step 3: System dependencies ------------------------------------------
step "Step 3: Installing system dependencies"
as_root apt-get update
# git is needed to clone/update; chromium + unclutter for the kiosk display.
as_root apt-get install -y git curl ca-certificates chromium-browser unclutter \
    || as_root apt-get install -y git curl ca-certificates chromium unclutter
echo "System dependencies installed"
echo ""

# ---- Step 4: Clone or update the repo -------------------------------------
step "Step 4: Fetching Nexus Kiosk source"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Existing checkout found — updating via git pull..."
    cd "$INSTALL_DIR"
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/$REPO_BRANCH"
elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    # Directory exists with files but is not a git repo (e.g. scp'd copy).
    # Initialize git in place and pull the canonical source over it.
    echo "Directory exists but is not a git repo — converting to a checkout..."
    cd "$INSTALL_DIR"
    git init -q
    git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/$REPO_BRANCH"
else
    echo "Cloning $REPO_URL ..."
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
# Make sure the kiosk user owns the tree (it may have been created by root).
as_root chown -R "$KIOSK_USER:$KIOSK_USER" "$INSTALL_DIR"
echo "Source ready in $INSTALL_DIR"
echo ""

# ---- Step 5: Install dependencies + build ---------------------------------
step "Step 5: Installing npm dependencies and building"
cd "$INSTALL_DIR"

# Wipe any node_modules that may have been copied from Windows (stale symlinks,
# missing +x on .bin, wrong platform binaries). Fresh install avoids all that.
echo "Removing old node_modules..."
rm -rf node_modules server/node_modules client/node_modules

echo "Running npm install..."
npm install

# Ensure every workspace .bin shim is executable (tsc, vite, tsx, etc.).
find "$INSTALL_DIR" -path "*/node_modules/.bin/*" -exec chmod +x {} \; 2>/dev/null || true

echo "Building client + server..."
npm run build
echo ""

# ---- Step 6: Environment file ---------------------------------------------
step "Step 6: Configuring environment (.env)"
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$INSTALL_DIR/.env.example" ]; then
        echo "Creating .env from .env.example..."
        cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
    else
        warn ".env.example not found — creating a minimal .env"
        cat > "$ENV_FILE" <<EOF
PORT=3001
NODE_ENV=production
ENCRYPTION_SECRET=
LOG_LEVEL=info
DISABLE_AZURE=false
EOF
    fi

    # Generate a strong encryption secret.
    ENCRYPTION_SECRET=$(openssl rand -base64 32)

    # Force NODE_ENV=production and inject the generated secret.
    if grep -q "^ENCRYPTION_SECRET=" "$ENV_FILE"; then
        sed -i "s|^ENCRYPTION_SECRET=.*|ENCRYPTION_SECRET=$ENCRYPTION_SECRET|" "$ENV_FILE"
    else
        echo "ENCRYPTION_SECRET=$ENCRYPTION_SECRET" >> "$ENV_FILE"
    fi

    if grep -q "^NODE_ENV=" "$ENV_FILE"; then
        sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$ENV_FILE"
    else
        echo "NODE_ENV=production" >> "$ENV_FILE"
    fi

    as_root chown "$KIOSK_USER:$KIOSK_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo ".env configured (NODE_ENV=production, ENCRYPTION_SECRET generated)"
    warn "NOTE: set AZURE_TENANT_ID and AZURE_CLIENT_ID in $ENV_FILE before first run."
else
    echo ".env already exists — leaving it untouched"
fi
echo ""

# ---- Step 7: Logging directory --------------------------------------------
step "Step 7: Setting up logging"
as_root mkdir -p /var/log/nexus-kiosk
as_root chown "$KIOSK_USER:$KIOSK_USER" /var/log/nexus-kiosk
as_root chmod 755 /var/log/nexus-kiosk
echo "Logging directory ready: /var/log/nexus-kiosk"
echo ""

# ---- Step 8: systemd services ---------------------------------------------
step "Step 8: Installing systemd services"

install_unit() {
    local src="$1" dest="$2" tmp
    tmp=$(mktemp)
    sed "s|KIOSK_USER|$KIOSK_USER|g; s|INSTALL_DIR|$INSTALL_DIR|g" "$src" > "$tmp"
    as_root cp "$tmp" "/etc/systemd/system/$dest"
    rm -f "$tmp"
    echo "  - /etc/systemd/system/$dest"
}

install_unit "$INSTALL_DIR/deploy/dashboard-backend.service"      "dashboard-backend.service"
install_unit "$INSTALL_DIR/deploy/dashboard-kiosk.service"        "dashboard-kiosk.service"
install_unit "$INSTALL_DIR/deploy/nexus-kiosk-updater.service"    "nexus-kiosk-updater.service"
as_root cp "$INSTALL_DIR/deploy/nexus-kiosk-updater.timer" "/etc/systemd/system/nexus-kiosk-updater.timer"
echo "  - /etc/systemd/system/nexus-kiosk-updater.timer"

chmod +x "$INSTALL_DIR/deploy/start-kiosk.sh" "$INSTALL_DIR/deploy/auto-update.sh" 2>/dev/null || true

as_root systemctl daemon-reload
as_root systemctl enable dashboard-backend.service
as_root systemctl enable dashboard-kiosk.service
as_root systemctl enable --now nexus-kiosk-updater.timer
echo "Services enabled (auto-update runs weekly: Sunday 03:30)"
echo ""

# ---- Step 9: nexus-kiosk command ------------------------------------------
step "Step 9: Creating 'nexus-kiosk' command"
chmod +x "$INSTALL_DIR/start.sh" 2>/dev/null || true
as_root ln -sf "$INSTALL_DIR/start.sh" /usr/local/bin/nexus-kiosk
echo "Run 'nexus-kiosk' from anywhere to start the dashboard"
echo ""

# ---- Step 10: lightdm autologin (best effort) -----------------------------
step "Step 10: Configuring autologin (lightdm)"
LIGHTDM_CONF="/etc/lightdm/lightdm.conf"
LIGHTDM_DROPIN="/etc/lightdm/lightdm.conf.d/50-nexus-kiosk.conf"
if [ -f "$LIGHTDM_CONF" ]; then
    echo "Configuring lightdm autologin as $KIOSK_USER..."
    if grep -q "^autologin-user=" "$LIGHTDM_CONF"; then
        as_root sed -i "s/^autologin-user=.*/autologin-user=$KIOSK_USER/" "$LIGHTDM_CONF"
    else
        as_root sed -i "/^\[Seat:\*\]/a autologin-user=$KIOSK_USER" "$LIGHTDM_CONF"
    fi
    if grep -q "^autologin-user-timeout=" "$LIGHTDM_CONF"; then
        as_root sed -i "s/^autologin-user-timeout=.*/autologin-user-timeout=0/" "$LIGHTDM_CONF"
    else
        as_root sed -i "/^autologin-user=/a autologin-user-timeout=0" "$LIGHTDM_CONF"
    fi
    echo "lightdm autologin configured"
elif [ -d "/etc/lightdm/lightdm.conf.d" ]; then
    echo "Configuring lightdm autologin via drop-in config..."
    as_root bash -c "cat > '$LIGHTDM_DROPIN' << 'EOF'
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
EOF"
    echo "lightdm autologin configured ($LIGHTDM_DROPIN)"
else
    warn "lightdm not found — skipping autologin"
    echo "To enable manually, add to /etc/lightdm/lightdm.conf under [Seat:*]:"
    echo "  autologin-user=$KIOSK_USER"
    echo "  autologin-user-timeout=0"
fi
echo ""

# ---- Restart backend -------------------------------------------------------
step "Restarting backend service..."
as_root fuser -k 3001/tcp 2>/dev/null || true
as_root systemctl restart dashboard-backend.service && echo "Backend restarted" || warn "Backend restart failed — run: sudo systemctl restart dashboard-backend"
echo ""

# ---- Done -----------------------------------------------------------------
log "=== Installation Complete ==="
echo ""
echo "Install directory: $INSTALL_DIR"
echo "Kiosk user:        $KIOSK_USER"
echo ""
step "Next steps:"
echo "1. Set Azure credentials in $INSTALL_DIR/.env:"
echo "     AZURE_TENANT_ID=..."
echo "     AZURE_CLIENT_ID=..."
echo "2. Start the dashboard:"
echo "     nexus-kiosk"
echo "   (or: sudo systemctl start dashboard-backend dashboard-kiosk)"
echo "3. Check status / logs:"
echo "     systemctl status dashboard-backend dashboard-kiosk"
echo "     sudo tail -f /var/log/nexus-kiosk/backend.log"
echo "4. To update later (anytime):"
echo "     NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash"
echo "5. Reboot to verify autologin + auto-start:"
echo "     sudo reboot"
echo ""
log "Done."
