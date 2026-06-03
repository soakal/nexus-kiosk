#!/usr/bin/env python3
"""Fully uninstall Nexus Kiosk on a remote host — services, app tree, logs, backups, board data."""
import sys
from pathlib import Path

import paramiko

from vm_common import HOST, INSTALL, PASSWORD, ROOT, SSH_PORT, USER

UNINSTALL_SH = ROOT / "deploy" / "uninstall-linux.sh"


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD environment variable", file=sys.stderr)
        return 1
    if not UNINSTALL_SH.is_file():
        print(f"Missing {UNINSTALL_SH}", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    script_body = UNINSTALL_SH.read_text(encoding="utf-8")
    pw_escaped = PASSWORD.replace("'", "'\"'\"'")

    remote_script = """#!/bin/bash
set -euo pipefail
PW='__PW__'
echo "${PW}" | sudo -S env NON_INTERACTIVE=1 INSTALL_DIR="__INSTALL__" KIOSK_USER="__USER__" bash <<'UNINSTALL_EOF'
__SCRIPT__
UNINSTALL_EOF
""".replace("__PW__", pw_escaped).replace("__INSTALL__", INSTALL).replace("__USER__", USER).replace("__SCRIPT__", script_body)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}:{SSH_PORT}...")
    client.connect(
        HOST,
        port=SSH_PORT,
        username=USER,
        password=PASSWORD,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )

    remote_path = "/tmp/nexus-kiosk-uninstall.sh"
    sftp = client.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write(remote_script)
    sftp.close()

    _, stdout, stderr = client.exec_command(f"bash {remote_path}", timeout=180)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err.strip()[-2000:], file=sys.stderr)

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
