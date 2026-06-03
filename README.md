# Nexus Kiosk

**VRSI Wall Dashboard** — a self-hosted, full-screen kiosk app for wall-mounted displays. It combines a **Microsoft 365 calendar** (with weather and agenda), **SharePoint recent files**, and an internal **Project Board** for operations scheduling (Excel import, per-job notes, status, and ship dates).

Runs in Chromium kiosk mode on Linux; developed on Windows or macOS with Vite + Express.

**License:** Private and proprietary — see [LICENSE](LICENSE). Copyright © VRSI. All rights reserved.

---

## What you get

| Area | What it does |
|------|----------------|
| **Calendar** | `react-big-calendar` day/week/month views, weekend hiding, ship-date overlay from the board |
| **Agenda** | Upcoming events with “Now” highlighting |
| **SharePoint** | Recent files panel (Graph API) |
| **Project Board** | Jobs from **Active Projects** `.xlsm`; tabs for Project, Spare Parts, Archive |
| **Board filters** | Multi-select Project Manager / Materials Manager dropdowns (Project + Spare Parts tabs) |
| **Notes** | Per-job notes; only the author can edit/delete; spreadsheet NOTE → read-only “Ops Schedule” note |
| **Status** | In Progress / Ready to Ship / Shipped checkmarks (imported from spreadsheet Status column) |
| **Ship dates** | Override imported ship date with optional reason; original date always visible |

The board (`/board`) does **not** require Azure. Calendar and SharePoint do (unless `DISABLE_AZURE=true` test mode).

---

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express 4, TypeScript, MSAL (device code), Microsoft Graph |
| Frontend | React 18, Vite, Tailwind 3, TanStack Query, Zustand, react-router-dom |
| Data | JSON files in `server/data/` (no database) |
| Import | `xlsx` parses uploaded `.xlsm` on the server |

---

## Prerequisites

- **Node.js 18+** and npm
- For calendar/SharePoint: Azure App Registration ([IT setup guide](docs/azure-for-it-admin.md))
- For kiosk deploy: Linux with systemd (see `deploy/`)

---

## Local development

### 1. Install dependencies

From the repo root (npm workspaces):

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

For day-to-day board/calendar UI work without Microsoft sign-in:

```env
DISABLE_AZURE=true
ENCRYPTION_SECRET=any-long-random-string-for-local-dev
```

With Azure enabled, set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `ENCRYPTION_SECRET`. See `.env.example` for all variables.

### 3. Run dev servers (two terminals)

```bash
cd server && npm run dev    # http://localhost:3001 — API
cd client && npm run dev    # http://localhost:5173 — UI (proxies /api → 3001)
```

Open **http://localhost:5173**.

- **Board** works immediately (pick a user on `/board/users`).
- **Calendar** with `DISABLE_AZURE=true` uses mock data; with Azure, complete [device code sign-in](https://microsoft.com/devicelogin) on first launch.

### 4. Import jobs locally

**Projects → Import** and upload your Operations Schedule `.xlsm` (sheet **Active Projects**). A full import updates:

- `jobs.json` — row data (customer, PM, dates)
- `board-state.json` — status checkmarks, Ops Schedule notes, overrides

Code deploy alone does **not** refresh notes/status — always import (or use `applyBoardImport` on the server).

---

## Project Board

### Routes

| Path | Purpose |
|------|---------|
| `/board` | Active project jobs (excludes spare + shipped) |
| `/board/spare-parts` | Spare carrier PM jobs + job numbers starting with `sp-` or `sp ` |
| `/board/archive` | Shipped jobs |
| `/board/users` | User picker, status colors, spare carrier PM |
| `/board/import` | Upload `.xlsm` |

### List UI (Project + Spare Parts)

Below the search bar:

- **Project Manager** and **Materials Manager** — side-by-side multi-select dropdowns
- Selected people appear as **bubbles inside the field** (× to remove one; **Clear** resets all)
- Filters persist per tab in the browser session
- Click PM or MM on a job card to add/remove that person from the filter
- Search matches job number, customer, PM, or MM

**Project tab only:** **My Jobs** / **All Jobs** toggle (hidden on Spare Parts and Archive).

### Job cards

- Job number + customer bubble (consistent hash color)
- Original ship date (top-right); editable override with optional reason
- Status checkboxes; binder printed (project jobs only — not shown on spare)
- Per-job notes with author-only edit/delete

### Data files (gitignored — never commit)

All under `server/data/`:

| File | Contents |
|------|----------|
| `jobs.json` | Spreadsheet rows only |
| `board-state.json` | Per job: `status`, `shipDateOverride`, `notes[]` |
| `board-config.json` | Spare carrier PM, super user, status colors |
| `config.json` | Dashboard settings (calendars, hours, weather) |
| `tokens.json` | Encrypted MSAL token cache |

Weekly kiosk auto-update runs `git reset --hard`. If any of these files were ever committed, the next update would **wipe board notes and status**.

### Import rules (Status column)

- **Cancelled** — row skipped  
- **Shipped** — archive tab  
- **Ready to Ship** / **Partially Shipped** — Ready to Ship checkmark  
- **Build**, **Parts on order**, **Design**, **Labor Only** — In Progress  
- **NOTE** column — one Ops Schedule note per job (`system:ops-schedule`; not editable in UI)

### API (no auth on board routes today)

- `POST /api/board/import` — file upload or JSON body  
- `GET /api/board/jobs` — merged jobs + state  
- `PATCH /api/board/jobs/:jobNumber/status` — 404 if job unknown  
- `PATCH /api/board/jobs/:jobNumber/ship-date` — `shipDateOverride`, optional `shipDateOverrideNote`  
- Notes: author-only `PATCH` / `DELETE`; Ops Schedule notes protected  

---

## Production build

```bash
cd client && npm run build
cd server && npm run build
node server/dist/index.js
```

Serves `client/dist` on port **3001**. In production you must set `CORS_ORIGIN` (same origin as the kiosk URL) and `ENCRYPTION_SECRET`; the server fails fast if they are missing.

---

## Linux kiosk install and update

**Fresh install:**

```bash
curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

**Update existing install:**

```bash
NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

Install scripts run a connectivity preflight and enable systemd units (`dashboard-backend`, `dashboard-kiosk`, optional weekly updater and 6-hourly board backups). Details: [CLAUDE.md](CLAUDE.md).

### Health check

`GET /health` → `{ status, authenticated, needsReauth, testMode, ready }`  
`ready: true` means token initialization finished (used by auto-update after restart).

### Backups (production kiosk)

```bash
sudo bash $INSTALL_DIR/deploy/backup.sh
sudo bash $INSTALL_DIR/deploy/restore.sh list
sudo bash $INSTALL_DIR/deploy/restore.sh latest
```

Archives: `/var/backups/nexus-kiosk/board-YYYY-MM-DD-HHMM.tar.gz` (28 retained).

---

## Work VM (testing)

| Item | Value |
|------|--------|
| Host | `10.10.11.24` |
| SSH | `vrsi@10.10.11.24` |
| Install dir | `/home/vrsi/nexus-kiosk` |
| URL | http://10.10.11.24:3001 |

**Testing limits:** Corporate Wi‑Fi often cannot reach the VM (mobile layout testing is on-LAN only). The live `.xlsm` path for auto-import exists on the VM (VMware drag-and-drop), not on your PC — use **Import** in the browser or the scripts below. Production is planned to use **O365 + SharePoint** for calendar, files, and job source.

### Helper scripts (from your PC)

Set `VM_PASSWORD` (never commit credentials). Optional: `VM_HOST`, `VM_USER`, `VM_INSTALL`, `VM_XLSM`, `VM_AUTO_IMPORT=1`.

| Script | Purpose |
|--------|---------|
| `python scripts/vm-deploy.py` | Upload changed sources, build, restart, auto-import if `.xlsm` on VM |
| `python scripts/vm-fix.py` | Re-run full import only |
| `python scripts/vm-install.py` | Fresh `install-linux.sh` (default: no import — set `VM_AUTO_IMPORT=1` to import) |
| `python scripts/vm-reinstall-clean.py` | Uninstall + fresh install |
| `python scripts/vm-uninstall.py` | Full remote uninstall (app, data, backups, services) |
| `python scripts/vm-wipe-board.py` | Delete board JSON only (keep app install) |
| `.\scripts\push-gitea.ps1` | Push `master` to LAN Gitea |

```powershell
$env:VM_PASSWORD = '…'
python scripts/vm-deploy.py
```

**Port 3001:** Another service (`/opt/tender/backend`) has been known to bind the port; `vm-deploy` frees it before restart.

**Uninstall on the VM:** `NON_INTERACTIVE=1 sudo bash $INSTALL_DIR/deploy/uninstall-linux.sh`

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `ENCRYPTION_SECRET` | Yes* | Token encryption (*optional if `DISABLE_AZURE=true` in some setups; still recommended) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | Yes unless `DISABLE_AZURE=true` | App registration |
| `CORS_ORIGIN` | Yes in production | Never defaults to `*` in production |
| `DISABLE_AZURE=true` | Dev/test | Mock calendar; board unchanged |
| `PORT` | No | Default `3001` |
| `LOG_LEVEL` | No | Default `info` |

Full list: [.env.example](.env.example).

---

## Git remotes

| Remote | URL |
|--------|-----|
| `origin` | https://github.com/soakal/nexus-kiosk.git |
| `gitea` | http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git (LAN org `vrsi-pc-build`; IP: `10.10.10.68`) |

```bash
git push origin master
git push gitea master
```

---

## Documentation

| Document | Audience |
|----------|----------|
| [CLAUDE.md](CLAUDE.md) | Short ops reference — deploy, data dir, import, VM gotchas |
| [HANDOFF-CHEESECAKE.md](HANDOFF-CHEESECAKE.md) | Full onboarding, architecture, TODO backlog |
| [docs/azure-for-it-admin.md](docs/azure-for-it-admin.md) | Azure App Registration for IT |
| [docs/vm-setup-guide.md](docs/vm-setup-guide.md) | VM setup notes |

---

## Security notes

- Board import parses **untrusted** `.xlsm` uploads server-side (`xlsx` SheetJS CDN **0.20.3**).
- Board and config APIs are **unauthenticated** on the LAN today; `ADMIN_TOKEN` gate is planned.
- Do not commit `server/.env`, install-root `.env`, `server/data/*.json`, or logs.

---

## Repository layout

```
client/          React UI
server/          Express API, Graph, board service
server/data/     Runtime JSON (gitignored)
deploy/          install-linux.sh, uninstall-linux.sh, systemd units, backup/restore
scripts/         vm-deploy.py, vm-fix.py, vm-install.py, vm-uninstall.py, push-gitea.ps1, …
docs/            Azure and VM guides
```
