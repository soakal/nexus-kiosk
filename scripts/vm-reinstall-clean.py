#!/usr/bin/env python3
"""Clean reinstall: backup JSON, wipe board data, sync GitHub, rebuild — empty board unless VM_AUTO_IMPORT=1."""
import sys

import paramiko

from vm_common import HOST, INSTALL, PASSWORD, PORT, SKIP_IMPORT, SSH_PORT, USER, XLSM

REMOTE_SCRIPT = r"""#!/bin/bash
set -euo pipefail
INSTALL="__INSTALL__"
XLSM="__XLSM__"
PORT="__PORT__"
SKIP_IMPORT="__SKIP_IMPORT__"
TS=$(date +%F-%H%M)
BACKUP="/var/backups/nexus-kiosk-clean-${TS}"
PW='__PW__'

echo "=== Nexus Kiosk clean reinstall (empty board) ==="
echo "Backup dir: ${BACKUP}"
echo "${PW}" | sudo -S mkdir -p "${BACKUP}"
echo "${PW}" | sudo -S cp -a "${INSTALL}/.env" "${BACKUP}/" 2>/dev/null || true
echo "${PW}" | sudo -S cp -a "${INSTALL}/server/data/"*.json "${BACKUP}/" 2>/dev/null || true

echo "Wiping runtime data (jobs, board-state, board-config, config, tokens)..."
rm -f "${INSTALL}/server/data/jobs.json"
rm -f "${INSTALL}/server/data/board-state.json"
rm -f "${INSTALL}/server/data/board-config.json"
rm -f "${INSTALL}/server/data/config.json"
rm -f "${INSTALL}/server/data/tokens.json"

cd "${INSTALL}"
echo "Syncing source from GitHub origin/master..."
git fetch origin master
git reset --hard origin/master
git log -1 --oneline

echo "Running install-linux.sh (NEXUS_UPDATE=1)..."
export NEXUS_UPDATE=1 INSTALL_DIR="${INSTALL}" KIOSK_USER="__USER__"
echo "${PW}" | sudo -S bash "${INSTALL}/deploy/install-linux.sh"

sleep 3
curl -sf "http://localhost:${PORT}/health" | python3 -m json.tool

if [ "${SKIP_IMPORT}" = "1" ]; then
  echo "SKIP_IMPORT: board left empty — use Projects -> Import when ready."
elif test -f "${XLSM}"; then
  echo "=== Spreadsheet import (VM_AUTO_IMPORT=1) ==="
  curl -sf -F "file=@${XLSM}" "http://localhost:${PORT}/api/board/import" | python3 -m json.tool
else
  echo "SKIP_IMPORT: xlsm not found at ${XLSM}"
fi

python3 <<'PY'
import json, urllib.request
jobs = json.loads(urllib.request.urlopen("http://localhost:__PORT__/api/board/jobs").read())
print("jobs_api_count:", len(jobs))
PY

echo "Data files after clean reinstall:"
ls -la "${INSTALL}/server/data/" 2>/dev/null || echo "(empty)"
echo "=== Clean reinstall complete ==="
echo "Backup saved at ${BACKUP}"
"""


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD environment variable", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pw_escaped = PASSWORD.replace("'", "'\"'\"'")
    script = (
        REMOTE_SCRIPT.replace("__INSTALL__", INSTALL)
        .replace("__XLSM__", XLSM)
        .replace("__PORT__", PORT)
        .replace("__USER__", USER)
        .replace("__SKIP_IMPORT__", "1" if SKIP_IMPORT else "0")
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

    remote_path = "/tmp/nexus-kiosk-reinstall-clean.sh"
    sftp = client.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write(script)
    sftp.close()

    _, stdout, stderr = client.exec_command(f"bash {remote_path}", timeout=900)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err.strip()[-3000:], file=sys.stderr)

    client.close()
    print(f"\nOpen http://{HOST}:{PORT}/board — hard-refresh (Ctrl+Shift+R).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
