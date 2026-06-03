---
name: project-overview
description: Nexus Kiosk project goals and current state
metadata:
  type: project
---

# Nexus Kiosk Project Overview

Wall dashboard (Dakboard replacement). GitHub: https://github.com/soakal/nexus-kiosk · Gitea: http://10.10.10.68:3000/briank/nexus-kiosk.git

## What it does

1. **Calendar / SharePoint** — Microsoft Graph (Device Code Flow), react-big-calendar, agenda, weather.
2. **Project Board** (`/board`) — jobs from Active Projects `.xlsm`; notes, status checkmarks, ship dates; no Azure required for board.

## Data (all under `server/data/`, gitignored)

- `jobs.json` — spreadsheet import (job rows, ship dates).
- `board-state.json` — per-job status, ship-date overrides, `notes[]` (user + Ops Schedule).
- `board-config.json`, `tokens.json`, `config.json`.

Full import must run via UI Import or `applyBoardImport` — not just `saveJobsFile`.

## Test VM

- **10.10.11.24** — `/home/vrsi/nexus-kiosk`, user `vrsi`.
- Helpers: `scripts/vm-deploy.py`, `scripts/vm-fix.py`, `scripts/push-gitea.ps1`.
- Testing: `DISABLE_AZURE=true` common; port 3001 conflicts with `/opt/tender/backend` possible.

## Testing-phase network (see HANDOFF)

- Corp network: phones usually cannot reach kiosk URL (no mobile layout testing off-LAN).
- PC dev: cannot see VM VMware drag-drop `.xlsm` path — import file via browser or SSH on VM.
- Production plan: O365 + SharePoint removes local-file dependency.

## Current status (2026-06)

- Board import: status mapping, NOTE → Ops Schedule notes, author-only note edit/delete.
- Calendar: week view without `work_week`; spare-tab routing; PM on ship events.
- Deploy: install-linux.sh, auto-update, backup/restore timers.
- Pending: scheduled auto-import from file share, xlsx upgrade, full Azure on kiosk.
