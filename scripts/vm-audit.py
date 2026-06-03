#!/usr/bin/env python3
"""HTTP audit of a Nexus Kiosk host — health, API, deployed frontend bundle."""
from __future__ import annotations

import json
import re
import socket
import sys
import urllib.error
import urllib.request

from vm_common import HOST, PORT, ROOT, SSH_PORT

MARKERS = ("Project Manager", "Materials Manager", "Upcoming ship dates")
LOCAL_DIST = ROOT / "client" / "dist"


def fetch(url: str, timeout: float = 12) -> tuple[int, str, dict[str, str]]:
    req = urllib.request.Request(url, headers={"Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, body, headers
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        headers = {k.lower(): v for k, v in e.headers.items()}
        return e.code, body, headers


def local_expected_joblist_chunk() -> str | None:
    index_html = LOCAL_DIST / "index.html"
    if not index_html.is_file():
        return None
    text = index_html.read_text(encoding="utf-8")
    index_js = re.search(r'src="/assets/(index-[^"]+\.js)"', text)
    if not index_js:
        return None
    index_path = LOCAL_DIST / "assets" / index_js.group(1).split("/")[-1]
    if not index_path.is_file():
        return None
    chunk = re.search(r"JobListView-([A-Za-z0-9_-]+)\.js", index_path.read_text(encoding="utf-8"))
    return f"JobListView-{chunk.group(1)}.js" if chunk else None


def ssh_open(host: str, port: int, timeout: float = 3) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def audit_host(host: str, port: str) -> int:
    base = f"http://{host}:{port}"
    issues: list[str] = []
    print(f"\n{'=' * 60}")
    print(f"Audit: {base}")
    print(f"{'=' * 60}")

    ssh_ok = ssh_open(host, SSH_PORT)
    print(
        f"SSH ({SSH_PORT}): "
        f"{'open — vm-deploy.py can run' if ssh_ok else 'closed — run NEXUS_UPDATE on the host console'}"
    )

    code, body, _ = fetch(f"{base}/health")
    if code != 200:
        issues.append(f"/health returned {code}")
        print(f"/health: FAIL ({code})")
    else:
        health = json.loads(body)
        print(
            f"/health: ok  ready={health.get('ready')}  testMode={health.get('testMode')}  "
            f"uptime={health.get('uptime', 0):.0f}s"
        )

    code, body, headers = fetch(f"{base}/api/nope")
    ctype = headers.get("content-type", "")
    if code != 404 or "json" not in ctype:
        issues.append("/api/nope should return JSON 404")
        print(f"/api/nope: FAIL ({code}, {ctype})")
    else:
        print("/api/nope: JSON 404 ok")

    code, body, _ = fetch(f"{base}/api/board/jobs")
    if code != 200:
        issues.append(f"/api/board/jobs returned {code}")
        print(f"/api/board/jobs: FAIL ({code})")
    else:
        jobs = json.loads(body)
        count = len(jobs) if isinstance(jobs, list) else "?"
        print(f"/api/board/jobs: {count} jobs")

    code, body, _ = fetch(f"{base}/api/board/config")
    if code == 200:
        cfg = json.loads(body)
        spare = cfg.get("spareCarrier") or "(not set)"
        print(f"/api/board/config: spareCarrier={spare}")
    else:
        issues.append(f"/api/board/config returned {code}")

    code, html, _ = fetch(f"{base}/")
    index_match = re.search(r'src="/assets/(index-[^"]+\.js)"', html)
    if not index_match:
        issues.append("index.html missing index-*.js reference")
        print("Frontend: index bundle not found in HTML")
        return 1

    index_name = index_match.group(1)
    print(f"Frontend index: {index_name}")

    code, index_js, _ = fetch(f"{base}/assets/{index_name}")
    jl_match = re.search(r"JobListView-([A-Za-z0-9_-]+)\.js", index_js)
    if not jl_match:
        issues.append("JobListView lazy chunk not referenced in index bundle")
        print("Frontend: JobListView chunk not found")
        return 1

    jl_name = f"JobListView-{jl_match.group(1)}.js"
    code, jl_body, _ = fetch(f"{base}/assets/{jl_name}")
    if code != 200 or jl_body.lstrip().startswith("<!"):
        issues.append(f"{jl_name} missing or SPA fallback")
        print(f"Frontend: {jl_name} NOT SERVED")
        return 1

    has_markers = all(m in jl_body for m in MARKERS)
    expected = local_expected_joblist_chunk()
    match_local = expected == jl_name if expected else None

    print(f"Frontend board: {jl_name}  ({len(jl_body)} bytes)")
    print(f"  PM/MM filters + mobile agenda: {'yes' if has_markers else 'NO — stale build'}")
    if expected:
        print(f"  matches local workspace build: {'yes' if match_local else f'no (local {expected})'}")

    if not has_markers:
        issues.append("stale frontend")
    if expected and not match_local:
        issues.append(f"bundle mismatch vs local build ({expected})")

    if issues:
        print("\nIssues:")
        for i, msg in enumerate(issues, 1):
            print(f"  {i}. {msg}")
        return 1

    print("\nAll checks passed.")
    return 0


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    hosts = sys.argv[1:] if len(sys.argv) > 1 else [HOST]
    rc = 0
    for h in hosts:
        rc = max(rc, audit_host(h, PORT))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
