"""Shared settings for remote VM helper scripts."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HOST = os.environ.get("VM_HOST", "10.10.11.24")
USER = os.environ.get("VM_USER", "vrsi")
PASSWORD = os.environ.get("VM_PASSWORD", "")
SSH_PORT = int(os.environ.get("VM_SSH_PORT", "22"))
PORT = os.environ.get("VM_PORT", "3001")
INSTALL = os.environ.get("VM_INSTALL", f"/home/{USER}/nexus-kiosk")
CORS_ORIGIN = os.environ.get("VM_CORS_ORIGIN", f"http://{HOST}:{PORT}")

# Fresh install / clean reinstall: empty board unless spreadsheet import is requested.
_auto = os.environ.get("VM_AUTO_IMPORT", "").lower() in ("1", "true", "yes")
_skip = os.environ.get("VM_SKIP_IMPORT", "").lower() in ("1", "true", "yes")
SKIP_IMPORT = _skip or not _auto
XLSM = os.environ.get(
    "VM_XLSM",
    "/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm",
)
