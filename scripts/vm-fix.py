#!/usr/bin/env python3
"""VM repair: full board import (jobs + status checkmarks + ops notes), verify health."""
import os
import sys

import paramiko

HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "")
XLSM = os.environ.get(
    "VM_XLSM",
    "/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm",
)
INSTALL = "/home/vrsi/nexus-kiosk"

REIMPORT_SCRIPT = r"""import { readFileSync } from 'fs';
import { parseXlsm, applyBoardImport } from '/home/vrsi/nexus-kiosk/server/dist/services/boardService.js';

const path = process.argv[2];
const name = 'Copy of Operations Schedule - Saved on - Active.xlsm';
const buf = readFileSync(path);
const r = parseXlsm(buf, name);
const applied = await applyBoardImport(r.jobs, name, r.importedStatuses, r.importedNotes);
console.log(
  'OK',
  r.jobs.length,
  'notes',
  applied.notesImported,
  'shipped',
  applied.shippedApplied,
  'rts',
  applied.readyToShipApplied,
  'in_progress',
  applied.inProgressApplied,
);
"""


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[str, str]:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (
        stdout.read().decode("utf-8", errors="replace"),
        stderr.read().decode("utf-8", errors="replace"),
    )


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD environment variable", file=sys.stderr)
        return 1
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)

    sftp = client.open_sftp()
    with sftp.file(f"{INSTALL}/reimport.mjs", "w") as f:
        f.write(REIMPORT_SCRIPT)
    sftp.close()

    out, err = run(client, f"node {INSTALL}/reimport.mjs '{XLSM}'", timeout=180)
    print("REIMPORT:", out.strip())
    if err.strip():
        print("REIMPORT ERR:", err.strip()[:1500])

    out, _ = run(
        client,
        f"""python3 << 'PY'
import json
s=json.load(open("{INSTALL}/server/data/board-state.json"))["jobs"]
ops=sum(1 for v in s.values() for n in v.get("notes",[]) if n.get("authorId")=="system:ops-schedule")
for jn in ("9201-016","9481-009","8857-001"):
    e=s.get(jn)
    print(jn, e.get("status") if e else "missing", "notes", len(e.get("notes",[])) if e else 0)
print("ops_schedule_notes", ops)
PY""",
    )
    print("VERIFY:", out.strip())

    out, err = run(
        client,
        "systemctl restart dashboard-backend 2>&1; sleep 5; curl -s http://localhost:3001/health",
    )
    print("HEALTH:", out.strip())
    if err.strip():
        print("RESTART ERR:", err.strip()[:500])

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
