# Nexus Kiosk

Self-hosted wall dashboard: Microsoft 365 calendar + SharePoint files. Runs on Linux in Chromium kiosk.

**Private proprietary software — Copyright © VRSI. See LICENSE.**

## Stack
Backend: Node.js + Express 4 + MSAL Node (Device Code Flow) + Microsoft Graph API
Frontend: React 18 + Vite + Tailwind 3 + react-big-calendar + TanStack Query v5 + Zustand v4

## Dev
  cd server && npm run dev   (port 3001)
  cd client && npm run dev   (port 5173, proxies /api to 3001)

## Production build
  cd client && npm run build
  cd server && npm run build
  node server/dist/index.js   (serves client/dist static on port 3001)

## Azure setup
1. New App Registration, no redirect URI
2. Authentication: enable "Allow public client flows" = Yes (REQUIRED for Device Code)
3. API permissions: Calendars.Read, User.Read, offline_access, Files.Read.All, Sites.Read.All
4. Copy tenant ID + client ID to .env

## First run
1. cp .env.example server/.env && fill in Azure credentials (local dev loads from `server/` when using `npm run dev`)
2. Start server + client dev servers
3. Open http://localhost:5173 — shows device code screen
4. Sign in at microsoft.com/devicelogin on your phone

On a **Linux kiosk**, `.env` lives at the install root (e.g. `/home/vrsi/nexus-kiosk/.env`) and is loaded by systemd — not under `server/`.

## Linux deploy (one command)
  curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash

## Linux update (one command)
  NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash

## Project Board ("Projects")
Self-contained job-tracking feature at the `/board` route. No Graph API / no auth required (user is chosen via a picker).
Tabs/routes: `/board` (Project), `/board/spare-parts` (Spare Parts), `/board/archive`, `/board/users` (picker + colors), `/board/import` (XLSM import).

**List filters (Project + Spare Parts):** Below the search bar — side-by-side multi-select dropdowns for **Project Manager** and **Materials Manager**. Selected names show as bubbles inside each field (× to remove). **Clear** on the label and inside the dropdown. Multiple PMs/MMs supported; both dropdowns apply together (match any selected PM **and** any selected MM). Selections persist per tab in `sessionStorage`. Click PM/MM on a job card to toggle that person in the filter.

**Job cards:** Job # + customer bubble (hash color), original ship date top-right, MM/PM line, status checkboxes, binder (project only — hidden on spare jobs), ship date editor with optional override reason, notes.

**Spare parts:** Job appears on Spare Parts tab if PM matches configured spare carrier **or** job number starts with `sp-` or `sp ` (case-insensitive). Binder checkbox hidden; API forces `binderPrinted: false` for spare jobs.

**Ship date override:** `shipDateOverride` + optional `shipDateOverrideNote` on PATCH; `originalShipDate` always shown from import.

**NEW badge:** Only for job numbers first seen in the **current** import (not carried forward from prior imports).

**Two JSON files (both gitignored):**
- `jobs.json` — spreadsheet rows (job #, customer, PM, ship dates). Refreshed on every import.
- `board-state.json` — per-job `status`, `shipDateOverride`, and `notes[]` (user notes + one Ops Schedule note from import). Keyed by job number.

Import (`POST /api/board/import` or `applyBoardImport`) must run to apply status checkmarks and NOTE column — deploy alone does not update board-state. `vm-deploy.py` runs a full import after each deploy when the Active Projects `.xlsm` is on the VM.

**Import status rules (Status column):** Cancelled/Canceled rows omitted. `Shipped` → archive. `Ready to Ship` / `Partially Shipped` → ready checkmarks. `Build`, `Parts on order`, `Design`, `Labor Only` → in progress. On Hold unchanged.

**Notes:** User notes (`authorId` = board user) — only that author may edit/delete (`PATCH`/`DELETE`). Ops Schedule notes (`authorId` = `system:ops-schedule`) come from spreadsheet NOTE column; not editable/deletable in UI.

WARNING: board data files MUST stay gitignored. Weekly `git reset --hard` (Sun 03:30) wipes any committed data.

## Data directory (IMPORTANT)
All persisted state lives in `server/data/`. tokenStore.ts, configService.ts, and boardService.ts now ALL resolve to the same `server/data` dir (previously token/config leaked to `<root>/data` and were NOT gitignored). Files: tokens.json, config.json, jobs.json, board-state.json, board-config.json — all gitignored.

## Env vars (validated at startup)
Server fails fast in bootstrap() if required vars are missing. Required: ENCRYPTION_SECRET, and (unless DISABLE_AZURE=true) AZURE_TENANT_ID + AZURE_CLIENT_ID. CORS_ORIGIN is REQUIRED in production — server refuses to start without it and never falls back to '*'. See .env.example for the full list. Testing/no-Azure runs: set DISABLE_AZURE=true.

## Connectivity checks (deploy scripts)
install-linux.sh and auto-update.sh now run a connectivity preflight (github.com, raw.githubusercontent.com, registry.npmjs.org, deb.nodesource.com) before any network op. auto-update.sh skips the run (exit 0) when offline so the weekly unattended update never strands the kiosk. git/npm/apt steps are guarded with clear failure messages.

## Backup / Restore
Board data is backed up automatically every 6 hours via `nexus-kiosk-backup.timer`.

  Backups location: /var/backups/nexus-kiosk/board-YYYY-MM-DD-HHMM.tar.gz
  Keeps: 28 copies (7 days × 4/day)
  Manual backup: sudo bash $INSTALL_DIR/deploy/backup.sh
  Scripts auto-detect install dir from their own location — no path config needed.

  List available backups:
    sudo bash $INSTALL_DIR/deploy/restore.sh list
  Restore latest:
    sudo bash $INSTALL_DIR/deploy/restore.sh latest
  Restore specific:
    sudo bash $INSTALL_DIR/deploy/restore.sh board-2026-06-03-0854.tar.gz

  On the work VM (10.10.11.24): INSTALL_DIR=/home/vrsi/nexus-kiosk
  Post-restore "WARNING: backend not responding" is harmless — backend just needs >3s to start.
  Verify after restore: systemctl status dashboard-backend

## Health endpoint
  GET /health returns: { status, authenticated, needsReauth, testMode, ready }
  ready:true = token initialization complete (any outcome) — used by auto-update.sh
  after restart to know the backend is fully up before declaring success.

## Graceful shutdown
  Server handles SIGTERM/SIGINT: drains in-flight requests (up to 10s), then exits.
  auto-update.sh uses `systemctl stop` before any force-kill.

## Recently fixed (audit 2026-06)
- Data-dir path inconsistency (token/config now in server/data, gitignored)
- Atomic JSON writes (temp-file + rename) for board/config/token state
- Startup env validation; CORS no longer defaults to '*'
- Status-checkbox colors honor user-configured palette; unified spare-job classification (BoardHeader vs JobListView)
- Deploy: `local attempt=0` bug fixed; connectivity preflight + guarded network steps
- logs/*.log removed from git and ignored (/logs/ + *.log in .gitignore)

## Testing-phase network (HANDOFF has detail)
On **corporate network**, phones usually cannot reach the test kiosk URL (no mobile layout testing off-LAN). On a **PC dev build**, the VM-only `.xlsm` drag-drop path is not visible — import via UI or SSH on the VM. Expected to resolve when calendar/files/jobs use **O365 + SharePoint**.

## VM deploy (work kiosk 10.10.11.24)
Install dir: `/home/vrsi/nexus-kiosk`. From dev machine (on LAN/VPN):

```powershell
$env:VM_PASSWORD='…'
python scripts/vm-deploy.py          # SFTP sources, build, restart, auto-import xlsm
python scripts/vm-fix.py             # full import only (jobs + board-state)
python scripts/vm-install.py         # fresh install-linux.sh (VM_SKIP_IMPORT=1 default — no auto-import)
python scripts/vm-reinstall-clean.py # uninstall + fresh install
python scripts/vm-uninstall.py       # remote uninstall-linux.sh (wipes app + data + backups)
python scripts/vm-wipe-board.py      # delete board JSON only (jobs/state/config)
python scripts/push-gitea.ps1        # push master to Gitea (LAN IP)
```

Optional env: `VM_HOST`, `VM_USER`, `VM_INSTALL`, `VM_XLSM`, `VM_AUTO_IMPORT=1` (import on fresh install).

Legacy one-off scripts and static HTML mockups (`mockup*.html`, `vm-fix2.py`, diagnostic `vm-*-diag*`) were removed — use the scripts above.

Uninstall on the VM directly: `NON_INTERACTIVE=1 sudo bash $INSTALL_DIR/deploy/uninstall-linux.sh`

Active spreadsheet on VM: `/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm`

Port 3001 conflicts: `/opt/tender/backend` has stolen the port before — `vm-deploy` runs `fuser -k 3001/tcp`. Kiosk `.env` may have `DISABLE_AZURE=true` (test mode, empty M365 calendar; board ship dates still show).

## Git remotes
- `origin` → https://github.com/soakal/nexus-kiosk.git (push/pull)
- `gitea` → http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git (LAN; migrated from `briank/nexus-kiosk`)

Do not add a second push URL on `origin` for Gitea — use `git push gitea master` separately.

## Calendar (dashboard)
- Ship-date events from board jobs; subject `#job · customer · PM`, `boardTab` routes calendar clicks to Project / Spare Parts / Archive.
- Week view: always native `week` (7 columns). Weekends off = Mon-start + CSS clip (not `work_week` — crashes on weekend events).
- Month weekends off: 7-day grid + clip right 2/7 columns.

## Recently fixed (wallboard dev notes 2026-06)
- Job card 5-line layout; customer hash-color bubble; original ship date top-right
- PM/MM multi-select dropdown filters (Project + Spare Parts); Clear button; session persistence per tab
- Ship date override reason field (`shipDateOverrideNote`); PATCH API + ShipDateEditor
- NEW badge only for jobs new in current import (`saveJobsFile` fix)
- Spare jobs: binder hidden in UI; `binderPrinted` forced false in API; import skips spare binder
- UsersView: manual Extra Users collapsed under Advanced
- `deploy/uninstall-linux.sh` + VM helper scripts (`vm-install`, `vm-uninstall`, `vm-reinstall-clean`, `vm-wipe-board`)
- `xlsx` upgraded to SheetJS CDN 0.20.3 (was registry 0.18.5)

## Recently fixed (2026-06 session)
- Full import pipeline: `applyBoardImport` writes status + Ops Schedule notes to `board-state.json` (not just `jobs.json`)
- Cancelled rows skipped; Ready to Ship / Build / Parts on order status mapping
- Calendar spare-job tab routing; PM on ship-date events; week view `work_week` removed
- Author-only note edit (`PATCH`) and delete; inline note errors in UI
- `vm-fix.py` / `vm-deploy.py` helpers; Gitea `http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git`

## Recently fixed (multi-agent review 2026-06)
- Ship-date import: wrong column stolen by multiline header; parseDateValue returned garbage strings
- Import now reports rowErrors + skipped count; UI shows amber partial-success banner
- JSON import path is partial (valid rows proceed even if some rows fail)
- pruneOrphanedBoardState preserves entries with notes; import path serialized through runExclusive
- writeJsonFile: fsync before rename + try/finally .tmp cleanup
- Note IDs: crypto.randomUUID() (was hrtime-based, could collide across restarts)
- 401 after update: /health ready field + auto-update HTTP readiness poll + client redirect debounce
- AgendaRail redesigned: time-column layout, accent bar, Now badge, dated section headers
- Calendar weekend dimming: positional nth-child replaced with weekends-hidden wrapper class
- Backup/restore scripts added; auto-update creates backup before each update

See HANDOFF-CHEESECAKE.md for the full TODO backlog.
