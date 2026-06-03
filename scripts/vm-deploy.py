#!/usr/bin/env python3
"""Deploy local workspace files to the kiosk VM and rebuild."""
import os
import sys

import paramiko

from vm_common import HOST, INSTALL, PASSWORD, ROOT, SSH_PORT, USER, XLSM

FILES = [
    "client/src/components/board/boardColors.ts",
    "client/src/components/board/BoardLayout.tsx",
    "client/src/components/board/BoardLayout.tsx",
    "client/src/components/board/BoardHeader.tsx",
    "client/src/components/board/JobListView.tsx",
    "client/src/components/board/BoardShipAgenda.tsx",
    "client/src/hooks/useBoard.ts",
    "client/src/components/CalendarView.tsx",
    "client/src/App.tsx",
    "client/src/components/Dashboard.tsx",
    "client/src/components/AgendaRail.tsx",
    "client/src/components/StalenessIndicator.tsx",
    "client/src/components/board/ImportView.tsx",
    "client/src/components/board/UsersView.tsx",
    "client/src/components/board/NotesSection.tsx",
    "client/src/components/board/JobCard.tsx",
    "client/src/components/board/ShipDateEditor.tsx",
    "client/src/components/board/BinderPrintedCheckbox.tsx",
    "client/src/types/board.ts",
    "client/src/api/boardApi.ts",
    "server/src/types/board.ts",
    "client/src/hooks/useAuth.ts",
    "client/src/hooks/useEvents.ts",
    "client/src/types/index.ts",
    "deploy/dashboard-backend.service",
    "server/src/routes/auth.ts",
    "server/src/routes/board.ts",
    "server/src/routes/events.ts",
    "server/src/services/boardService.ts",
    "server/src/services/personIdentity.ts",
    "client/src/utils/personIdentity.ts",
    "client/src/types/index.ts",
]


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[str, str]:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (
        stdout.read().decode("utf-8", errors="replace"),
        stderr.read().decode("utf-8", errors="replace"),
    )


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        port=SSH_PORT,
        username=USER,
        password=PASSWORD,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD environment variable", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"Connecting to {USER}@{HOST}:{SSH_PORT}...")
    client = connect()

    sftp = client.open_sftp()
    print("Uploading changed files...")
    for rel in FILES:
        local = ROOT / rel
        remote = f"{INSTALL}/{rel.replace(chr(92), '/')}"
        remote_dir = os.path.dirname(remote)
        parts = remote_dir.split("/")
        path = ""
        for part in parts:
            if not part:
                continue
            path += "/" + part
            try:
                sftp.stat(path)
            except OSError:
                try:
                    sftp.mkdir(path)
                except OSError:
                    pass
        sftp.put(str(local), remote)
        print(f"  {rel}")
    sftp.close()

    pw = PASSWORD.replace("'", "'\"'\"'")
    steps = [
        f"echo '{pw}' | sudo -S chown -R {USER}:{USER} {INSTALL} 2>&1",
        f"cd {INSTALL}/client && npm run build",
        f"cd {INSTALL}/server && npm run build",
        f"echo '{pw}' | sudo -S cp {INSTALL}/deploy/dashboard-backend.service /etc/systemd/system/dashboard-backend.service 2>&1",
        f"echo '{pw}' | sudo -S sed -i 's/KIOSK_USER/{USER}/; s|INSTALL_DIR|{INSTALL}|g' /etc/systemd/system/dashboard-backend.service 2>&1",
        f"echo '{pw}' | sudo -S systemctl daemon-reload 2>&1",
        "pgrep -f '/opt/tender/backend' && echo TENDER_RUNNING || echo no_tender",
        f"echo '{pw}' | sudo -S fuser -k 3001/tcp 2>/dev/null; sleep 2",
        f"echo '{pw}' | sudo -S systemctl restart dashboard-backend 2>&1",
        "sleep 5",
        "curl -sf http://localhost:3001/health | python3 -m json.tool",
        "systemctl is-active dashboard-backend",
        f"echo '{pw}' | sudo -S systemctl restart dashboard-kiosk 2>&1 || true",
        f'test -f "{XLSM}" && curl -sf -F "file=@{XLSM}" http://localhost:3001/api/board/import | python3 -m json.tool || echo "SKIP_IMPORT: xlsm not found"',
    ]

    for cmd in steps:
        print(f"\n>>> {cmd[:80]}...")
        out, err = run(client, cmd)
        if out.strip():
            print(out.strip()[-3000:])
        if err.strip() and "authenticate" not in err.lower():
            print("stderr:", err.strip()[-800:])

    client.close()
    print(f"\nDeploy finished. Open http://{HOST}:3001 and hard-refresh (Ctrl+Shift+R).")
    return 0


def fix_client_build() -> int:
    """Fix client/dist permissions and rebuild only."""
    if not PASSWORD:
        print("Set VM_PASSWORD", file=sys.stderr)
        return 1
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = connect()
    pw = PASSWORD.replace("'", "'\"'\"'")
    for cmd in [
        f"echo '{pw}' | sudo -S chown -R {USER}:{USER} {INSTALL} 2>&1",
        f"echo '{pw}' | sudo -S rm -rf {INSTALL}/client/dist",
        f"cd {INSTALL}/client && npm run build",
        f"test -f {INSTALL}/client/dist/index.html && echo BUILD_OK || echo BUILD_FAIL",
        f"echo '{pw}' | sudo -S systemctl restart dashboard-backend",
        "sleep 4",
        "curl -s http://localhost:3001/health",
    ]:
        print(f">>> {cmd[:70]}")
        out, err = run(client, cmd)
        if out.strip():
            print(out.strip()[-2000:])
        if err.strip():
            print("stderr:", err.strip()[-400:])
    client.close()
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fix-client":
        raise SystemExit(fix_client_build())
    raise SystemExit(main())
