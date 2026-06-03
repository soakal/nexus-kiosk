#!/usr/bin/env python3
"""One-off VM repair: re-import jobs, verify health."""
import paramiko
import sys

import os

HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "")
XLSM = "/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm"

REIMPORT_SCRIPT = r"""import { readFileSync } from 'fs';
import { parseXlsm, saveJobsFile } from '/home/vrsi/nexus-kiosk/server/dist/services/boardService.js';
const r = parseXlsm(readFileSync(process.argv[2]), 'active.xlsm');
saveJobsFile(r.jobs, 'Copy of Operations Schedule - Saved on - Active.xlsm');
console.log('OK', r.jobs.length, 'dates', r.jobs.filter(j => j.shipToCustomer).length);
"""


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[str, str]:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err


def main() -> int:
    if not PASSWORD:
        print("Set VM_PASSWORD env var", file=sys.stderr)
        return 1
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)

    sftp = client.open_sftp()
    with sftp.file("/home/vrsi/nexus-kiosk/reimport.mjs", "w") as f:
        f.write(REIMPORT_SCRIPT)
    sftp.close()

    out, err = run(client, f"node /home/vrsi/nexus-kiosk/reimport.mjs '{XLSM}'")
    print("REIMPORT:", out.strip())
    if err.strip():
        print("REIMPORT ERR:", err.strip()[:1500])

    out, err = run(
        client,
        'python3 -c "import json; j=json.load(open(\'/home/vrsi/nexus-kiosk/server/data/jobs.json\'))[\'jobs\']; print(sum(1 for x in j if x.get(\'shipToCustomer\')), \'with dates of\', len(j))"',
    )
    print("VERIFY:", out.strip())

    out, err = run(client, "systemctl restart dashboard-backend 2>&1; sleep 5; curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3001/health")
    print("HEALTH:", out.strip())
    if err.strip():
        print("RESTART ERR:", err.strip()[:500])

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
