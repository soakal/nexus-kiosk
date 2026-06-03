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
| **Notes** | Per-job notes; only the author can edit/delete; spreadsheet NOTE → read-only “Ops Schedule” note |
| **Status** | In Progress / Ready to Ship / Shipped checkmarks (imported from spreadsheet Status column) |

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
| `/board` | Active project jobs |
| `/board/spare-parts` | Spare-parts PM + jobs whose number starts with `sp-` or `sp ` |
| `/board/archive` | Shipped jobs |
| `/board/users` | User picker and status colors |
| `/board/import` | Upload `.xlsm` |

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

Set `VM_PASSWORD` (never commit credentials):

```powershell
$env:VM_PASSWORD = '…'
python scripts/vm-deploy.py   # upload sources, build, restart, auto-import if .xlsm present
python scripts/vm-fix.py      # re-run full import only
```

```powershell
.\scripts\push-gitea.ps1      # push to LAN Gitea
```

**Port 3001:** Another service (`/opt/tender/backend`) has been known to bind the port; `vm-deploy` frees it before restart.

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

- Board import accepts **untrusted** `.xlsm` uploads; `xlsx@0.18.5` has known CVEs — upgrade tracked in HANDOFF.
- Board and config APIs are **unauthenticated** on the LAN today; `ADMIN_TOKEN` gate is planned.
- Do not commit `server/.env`, `server/data/*.json`, or logs.

---

## Repository layout

```
client/          React UI
server/          Express API, Graph, board service
server/data/     Runtime JSON (gitignored)
deploy/          install-linux.sh, systemd units, backup/restore
scripts/         vm-deploy.py, vm-fix.py, push-gitea.ps1
docs/            Azure and VM guides
```
