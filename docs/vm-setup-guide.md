# VRSI Dashboard — VM Setup Guide

This guide walks you through deploying the Nexus Kiosk dashboard onto a Linux virtual machine running under VMware (or any other hypervisor). By the end you will have a fully automated kiosk that starts on boot, auto-updates every Sunday at 3:30 AM, and is reachable from a single command.

---

## 1. Configure VMware Networking

The VM needs a real IP address on your local network so that Windows can SSH into it.

1. Power off the VM (if it is running).
2. Open **VM > Settings > Network Adapter**.
3. Select **Bridged** mode.
   - Bridged mode puts the VM directly on your physical network so it gets its own DHCP address, exactly like a separate machine.
   - Avoid NAT for this workflow; NAT makes the VM hard to reach from Windows without extra port-forwarding rules.
4. Click **OK**, then power the VM back on.

---

## 2. Find the VM IP Address

Inside the running VM, open a terminal and run:

```bash
hostname -I
```

This prints every IP address assigned to the VM. Copy the first address shown (typically `192.168.x.x` or `10.x.x.x`). You will use it in every step below.

---

## 3. Enable SSH on the VM

Still inside the VM terminal:

```bash
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
```

Verify SSH is running:

```bash
sudo systemctl status ssh
```

You should see `Active: active (running)`.

---

## 4. Test SSH from Windows

Open **PowerShell** on your Windows host and run:

```powershell
ssh username@192.168.x.x
```

Replace `username` with your Linux account name and `192.168.x.x` with the IP from Step 2. Accept the host fingerprint prompt the first time. If you see a shell prompt inside the VM, SSH is working correctly.

---

## 5. Optional: Password-Free Login (SSH Key Authentication)

Typing a password every time gets old quickly. Set up key-based auth:

**On Windows (PowerShell):**

```powershell
# Generate a key pair if you do not already have one
ssh-keygen -t ed25519 -C "my-vm-key"

# Display the public key — copy the entire output
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

**On the VM (inside an SSH session):**

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Paste the public key text you copied from Windows
nano ~/.ssh/authorized_keys
# Save with Ctrl+O, exit with Ctrl+X
chmod 600 ~/.ssh/authorized_keys
```

From now on `ssh username@ip` will connect without a password prompt.

> Note: Windows does not ship with `ssh-copy-id`. The manual copy above is the equivalent.

---

## 6. Deploy the App

SSH into the VM and run this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

Hit **Enter** twice to accept the defaults (install dir and user are auto-detected).

The installer will:
- Clone the repository from GitHub automatically
- Install Node.js if needed
- Install all npm dependencies (with correct Linux permissions)
- Build the client and server
- Install all systemd services
- Set up the weekly auto-update timer
- Create the `nexus-kiosk` convenience command

> **Note:** The GitHub repo must be public for this to work. If it's private, you'll need a GitHub token or clone manually first.

---

## 7. Configure Azure Credentials

The dashboard reads Azure / Microsoft 365 credentials from a `.env` file. SSH into the VM and edit it:

```bash
nano ~/nexus-kiosk/.env
```

Fill in the values specific to your Azure app registration (client ID, tenant ID, client secret, etc.). Save with **Ctrl+O** then exit with **Ctrl+X**.

---

## 8. Start the Dashboard

From anywhere on the VM:

```bash
nexus-kiosk
```

This starts both the backend API service and the kiosk browser. To start individual services manually:

```bash
sudo systemctl start dashboard-backend.service
sudo systemctl start dashboard-kiosk.service
```

Check that everything is running:

```bash
sudo systemctl status dashboard-backend.service
sudo systemctl status dashboard-kiosk.service
```

---

## 9. Automatic Updates

The installer configures a systemd timer that pulls the latest code and rebuilds the app automatically.

| Setting | Value |
|---|---|
| Schedule | Every Sunday at 3:30 AM |
| Log file | `/var/log/nexus-kiosk/update.log` |
| Timer unit | `nexus-kiosk-updater.timer` |

**Check the timer status:**

```bash
systemctl list-timers nexus-kiosk-updater.timer
```

**Run an update manually at any time:**

```bash
NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

**Tail the update log:**

```bash
sudo tail -f /var/log/nexus-kiosk/update.log
```

---

## 10. Uninstall

To remove the dashboard and all installed components:

```bash
NON_INTERACTIVE=1 sudo bash ~/nexus-kiosk/deploy/uninstall-linux.sh
```

This stops all systemd services (backend, kiosk, backup, auto-update), removes the install directory (including `.env`, `server/data/*.json` — jobs, notes, status), log directory, and all `/var/backups/nexus-kiosk*` archives. Use interactive mode (without `NON_INTERACTIVE=1`) for confirmation prompts.
