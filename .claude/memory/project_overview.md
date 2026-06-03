---
name: project-overview
description: Nexus Kiosk project goals and current state
metadata:
  type: project
---

# Nexus Kiosk Project Overview

Wall dashboard (Dakboard replacement). GitHub: https://github.com/soakal/nexus-kiosk · Gitea: http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git

## What it does

1. **Calendar / SharePoint** — Microsoft Graph (Device Code Flow), react-big-calendar, agenda, weather. Ship-date overlay from board; clicks route to correct Projects tab.
2. **Project Board** (`/board`) — jobs from Active Projects `.xlsm`; notes, status checkmarks, ship dates with override reason; no Azure required for board.

## Board UI (2026-06)

- **Filters:** PM + MM multi-select dropdowns below search (Project + Spare Parts); bubbles inside field; Clear button; session persistence per tab.
- **Cards:** Job # + customer bubble, original ship date, MM/PM line, status, binder (project only), ship override + reason, notes.
- **Spare:** PM matches spare carrier OR job # starts with `sp-` / `sp `; binder hidden/forced false.
- **NEW badge:** Only job numbers new in current import.

## Data (all under `server/data/`, gitignored)

- `jobs.json` — spreadsheet import (job rows, ship dates).
- `board-state.json` — per-job status, ship-date overrides + reason, `notes[]` (user + Ops Schedule).
- `board-config.json`, `tokens.json`, `config.json`.

Full import must run via UI Import or `applyBoardImport` — not just `saveJobsFile`.

## Test VM

- **10.10.11.24** — `/home/vrsi/nexus-kiosk`, user `vrsi`.
- Helpers: `vm-deploy.py`, `vm-fix.py`, `vm-install.py`, `vm-uninstall.py`, `vm-reinstall-clean.py`, `vm-wipe-board.py`, `push-gitea.ps1`.
- Testing: `DISABLE_AZURE=true` common; port 3001 conflicts with `/opt/tender/backend` possible.

## Testing-phase network (see HANDOFF)

- Corp network: phones usually cannot reach kiosk URL (no mobile layout testing off-LAN).
- PC dev: cannot see VM VMware drag-drop `.xlsm` path — import file via browser or SSH on VM.
- Production plan: O365 + SharePoint removes local-file dependency.

## Current status (2026-06)

- Board import: status mapping, NOTE → Ops Schedule notes, author-only note edit/delete.
- Calendar: week view without `work_week`; spare-tab routing; `#job · customer · PM` on ship events.
- Deploy: install-linux.sh, uninstall-linux.sh, auto-update, backup/restore timers.
- xlsx: SheetJS CDN 0.20.3 (server).
- Pending: scheduled auto-import from file share, full Azure on kiosk.
