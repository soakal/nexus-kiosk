#!/bin/bash
set -euo pipefail

VM_USER="${1:-}"
VM_IP="${2:-}"
INSTALL_DIR="${3:-}"

if [ -z "$VM_USER" ] || [ -z "$VM_IP" ]; then
    echo "Usage: $0 <vm-user> <vm-ip> [install-dir]"
    echo "  vm-user     SSH username on the target VM"
    echo "  vm-ip       IP address or hostname of the target VM"
    echo "  install-dir Destination directory on the VM (default: /home/<vm-user>/nexus-kiosk)"
    exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/home/$VM_USER/nexus-kiosk}"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

echo "Deploying VRSI Dashboard to $VM_USER@$VM_IP"
echo "  Branch:      $BRANCH"
echo "  Install dir: $INSTALL_DIR"
echo ""

ssh "$VM_USER@$VM_IP" bash <<REMOTE
set -euo pipefail

INSTALL_DIR="$INSTALL_DIR"
BRANCH="$BRANCH"
VM_USER="$VM_USER"

# Bail out clearly if the VM cannot reach GitHub instead of hanging on git.
curl -fsS --connect-timeout 5 --max-time 10 -o /dev/null https://github.com 2>/dev/null \
    || { echo 'VM cannot reach github.com — check the VM network connection' >&2; exit 1; }

# Finite git timeout so a stalled transfer aborts instead of hanging.
export GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=20
if [ -d "\$INSTALL_DIR/.git" ]; then
    echo "Repository already exists — pulling latest changes..."
    cd "\$INSTALL_DIR"
    git fetch origin "\$BRANCH" || { echo 'git fetch failed on VM' >&2; exit 1; }
    git reset --hard "origin/\$BRANCH" || { echo 'git reset failed on VM' >&2; exit 1; }
else
    echo "Cloning repository..."
    git clone -b "\$BRANCH" https://github.com/soakal/nexus-kiosk.git "\$INSTALL_DIR" \
        || { echo 'git clone failed on VM' >&2; exit 1; }
    cd "\$INSTALL_DIR"
fi

export NON_INTERACTIVE=1
export INSTALL_DIR="\$INSTALL_DIR"
export KIOSK_USER="\$VM_USER"

bash deploy/install-linux.sh
REMOTE

echo ""
echo "Deploy complete! Edit $INSTALL_DIR/.env with Azure credentials then run: nexus-kiosk"
