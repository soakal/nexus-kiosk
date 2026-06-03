#!/usr/bin/env python3
"""Run full board import on VM and verify board-state."""
import os
import sys

import paramiko

HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "vrsi")
XLSM = "/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm"
STATE = "/home/vrsi/nexus-kiosk/server/data/board-state.json"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("stderr:", err.strip()[:800])
    return out


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)

    print("board-state before:")
    print(run(client, f"test -f {STATE} && wc -c {STATE} || echo missing"))

    print("\nPOST /api/board/import ...")
    # Quote path for spaces
    out = run(
        client,
        f'curl -s -F "file=@{XLSM}" http://localhost:3001/api/board/import',
    )
    print(out.strip())

    verify = f"""python3 << 'PY'
import json
s=json.load(open("{STATE}"))["jobs"]
for jn in ("9201-016","9481-009","8857-001"):
    e=s.get(jn)
    if not e:
        print(jn, "NO STATE")
        continue
    ops=[n for n in e.get("notes",[]) if n.get("authorId")=="system:ops-schedule"]
    print(jn, "status="+str(e.get("status")), "notes="+str(len(e.get("notes",[]))), "ops="+str(len(ops)))
    if ops:
        print("  ops preview:", ops[0].get("text","")[:60])
ops_total=sum(1 for v in s.values() for n in v.get("notes",[]) if n.get("authorId")=="system:ops-schedule")
rts=sum(1 for v in s.values() if v.get("status")=="ready_to_ship")
print("TOTAL state jobs", len(s), "ops notes", ops_total, "ready_to_ship", rts)
PY"""
    print("\nafter import:")
    print(run(client, verify))
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
