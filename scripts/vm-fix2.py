#!/usr/bin/env python3
import os
import sys
import paramiko

HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "")

SERVICE = """[Unit]
Description=Nexus Kiosk Backend
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=vrsi
WorkingDirectory=/home/vrsi/nexus-kiosk
ExecStartPre=/bin/sh -c 'fuser -k 3001/tcp 2>/dev/null; sleep 1; true'
ExecStart=/usr/bin/node /home/vrsi/nexus-kiosk/server/dist/index.js
ExecStopPost=/bin/sh -c 'fuser -k 3001/tcp 2>/dev/null; true'
Restart=always
RestartSec=5
KillMode=control-group
TimeoutStopSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/vrsi/nexus-kiosk/.env
StandardOutput=append:/var/log/nexus-kiosk/backend.log
StandardError=append:/var/log/nexus-kiosk/backend.log

[Install]
WantedBy=multi-user.target
"""


def run(client, cmd, timeout=60):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return stdout.read().decode("utf-8", errors="replace"), stderr.read().decode("utf-8", errors="replace")


def main():
    if not PASSWORD:
        print("Set VM_PASSWORD", file=sys.stderr)
        return 1
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)

    # Restore test mode until Azure sign-in is done (avoids boot loop while tender is cleared)
    run(client, r"sed -i 's/^# DISABLE_AZURE=true.*/DISABLE_AZURE=true/' /home/vrsi/nexus-kiosk/.env || echo 'DISABLE_AZURE=true' >> /home/vrsi/nexus-kiosk/.env")

    sftp = client.open_sftp()
    with sftp.file("/tmp/dashboard-backend.service", "w") as f:
        f.write(SERVICE)
    sftp.close()

    pw = PASSWORD.replace("'", "'\"'\"'")
    steps = [
        f"echo '{pw}' | sudo -S cp /tmp/dashboard-backend.service /etc/systemd/system/dashboard-backend.service",
        f"echo '{pw}' | sudo -S systemctl daemon-reload",
        f"echo '{pw}' | sudo -S kill 1076336 1076347 2>/dev/null; sleep 1",
        f"echo '{pw}' | sudo -S fuser -k 3001/tcp 2>/dev/null; sleep 2",
        f"echo '{pw}' | sudo -S systemctl restart dashboard-backend",
        "sleep 5",
        "curl -s http://localhost:3001/health | python3 -m json.tool",
        "systemctl is-active dashboard-backend",
        "fuser -v 3001/tcp 2>&1",
        "wc -c /etc/systemd/system/dashboard-backend.service",
    ]
    for cmd in steps:
        out, err = run(client, cmd)
        print(f">>> {cmd[:70]}")
        print(out.strip())
        if err.strip():
            print("  err:", err.strip()[:300])
        print()

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
