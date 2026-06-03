#!/usr/bin/env python3
"""Fresh install on a Linux kiosk host via install-linux.sh, then optional spreadsheet import."""
import os
import sys

import paramiko

from vm_common import CORS_ORIGIN, HOST, INSTALL, PASSWORD, PORT, SKIP_IMPORT, SSH_PORT, USER, XLSM

REMOTE_SCRIPT = r"""#!/bin/bash
set -euo pipefail
INSTALL="__INSTALL__"
XLSM="__XLSM__"
CORS="__CORS__"
HOST="__HOST__"
PORT="__PORT__"
SKIP_IMPORT="__SKIP_IMPORT__"
PW='__PW__'

echo "=== Running install-linux.sh ==="
curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh -o /tmp/nexus-kiosk-install-linux.sh
chmod +x /tmp/nexus-kiosk-install-linux.sh
echo "${PW}" | sudo -S env NON_INTERACTIVE=1 INSTALL_DIR="${INSTALL}" KIOSK_USER="$(basename "$(dirname "${INSTALL}")")" bash /tmp/nexus-kiosk-install-linux.sh
rm -f /tmp/nexus-kiosk-install-linux.sh

echo "=== Post-install: kiosk .env ==="
if [ -f "${INSTALL}/.env" ]; then
  if grep -q '^DISABLE_AZURE=' "${INSTALL}/.env"; then
    sed -i 's|^DISABLE_AZURE=.*|DISABLE_AZURE=true|' "${INSTALL}/.env"
  else
    echo 'DISABLE_AZURE=true' >> "${INSTALL}/.env"
  fi
  if grep -q '^CORS_ORIGIN=' "${INSTALL}/.env"; then
    sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS}|" "${INSTALL}/.env"
  else
    echo "CORS_ORIGIN=${CORS}" >> "${INSTALL}/.env"
  fi
  echo "${PW}" | sudo -S systemctl restart dashboard-backend 2>/dev/null || true
  echo "${PW}" | sudo -S systemctl restart dashboard-kiosk 2>/dev/null || true
  sleep 5
fi

curl -sf "http://localhost:${PORT}/health" | python3 -m json.tool

if [ "${SKIP_IMPORT}" = "1" ]; then
  echo "SKIP_IMPORT: VM_SKIP_IMPORT set — upload spreadsheet via Projects -> Import."
else
  echo "=== Full spreadsheet import ==="
  if test -f "${XLSM}"; then
    curl -sf -F "file=@${XLSM}" "http://localhost:${PORT}/api/board/import" | python3 -m json.tool
  else
    echo "SKIP_IMPORT: xlsm not found at ${XLSM}"
    echo "Upload via Projects -> Import in the browser."
  fi
fi

echo "=== Install complete ==="
echo "Open http://${HOST}:${PORT}"
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
        .replace("__CORS__", CORS_ORIGIN)
        .replace("__HOST__", HOST)
        .replace("__PORT__", PORT)
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

    remote_path = "/tmp/nexus-kiosk-install.sh"
    sftp = client.open_sftp()
    with sftp.file(remote_path, "w") as f:
        f.write(script)
    sftp.close()

    _, stdout, stderr = client.exec_command(f"bash {remote_path}", timeout=900)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err.strip()[-4000:], file=sys.stderr)

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
