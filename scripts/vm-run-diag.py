#!/usr/bin/env python3
import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "vrsi")
XLSM = "/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()
    sftp.put(str(ROOT / "scripts" / "vm-diag-status.mjs"), "/home/vrsi/nexus-kiosk/vm-diag-status.mjs")
    sftp.close()
    _, stdout, stderr = client.exec_command(f"node /home/vrsi/nexus-kiosk/vm-diag-status.mjs '{XLSM}'", timeout=60)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip():
        print("ERR", err[:1500])
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
