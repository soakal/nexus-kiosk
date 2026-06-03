#!/usr/bin/env python3
"""Wipe board data on the kiosk VM without re-importing."""
import os
import sys

import paramiko

from vm_common import HOST, INSTALL, PASSWORD, SSH_PORT, USER

REMOTE_SCRIPT = r"""#!/bin/bash
set -euo pipefail
INSTALL="__INSTALL__"
PW='__PW__'

echo "=== Wiping board data (no re-import) ==="
rm -f "${INSTALL}/server/data/jobs.json"
rm -f "${INSTALL}/server/data/board-state.json"
rm -f "${INSTALL}/server/data/board-config.json"

echo "${PW}" | sudo -S systemctl restart dashboard-backend
sleep 4

curl -sf http://localhost:3001/health | python3 -m json.tool

python3 <<'PY'
import json, urllib.request
try:
    jobs = json.loads(urllib.request.urlopen("http://localhost:3001/api/board/jobs").read())
    print("jobs_api_count:", len(jobs))
except Exception as ex:
    print("jobs_api:", ex)
PY

echo "=== Done — board is empty until you import ==="
echo "Open http://__HOST__:3001/board and use Projects -> Import when ready."
"""


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD environment variable", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pw_escaped = PASSWORD.replace("'", "'\"'\"'")
    script = (
        REMOTE_SCRIPT.replace("__INSTALL__", INSTALL)
        .replace("__HOST__", HOST)
        .replace("__PW__", pw_escaped)
    )

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

    remote_path = "/tmp/nexus-kiosk-wipe-board.sh"
    sftp = client.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write(script)
    sftp.close()

    _, stdout, stderr = client.exec_command(f"bash {remote_path}", timeout=120)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err.strip()[-2000:], file=sys.stderr)

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
