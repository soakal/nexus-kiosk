# Handoff to Cheesecake 🧀

Welcome aboard! This is **Nexus Kiosk** (a.k.a. the VRSI Wallboard). This doc gets you from zero to productive. Read CLAUDE.md too — it's the short-form source of truth.

---

## What the app does

A self-hosted wall dashboard that runs full-screen in Chromium kiosk mode on a Linux box mounted on the wall. Two big features:

1. **Calendar / SharePoint** — pulls a Microsoft 365 calendar (and SharePoint files) via the Microsoft Graph API and shows it on a `react-big-calendar` view with a weather widget and agenda rail.
2. **Project Board ("Projects")** — a self-contained job-tracking board at `/board`. No Azure/auth needed; the user is chosen from a picker. Jobs are imported from an `.xlsm` spreadsheet ("Active Projects" sheet), and people add notes / set status / set ship dates per job. This is the part people touch every day.

Currently in a **testing phase**. No live SharePoint/O365 access in dev — always run with `DISABLE_AZURE=true` locally.

### Testing-phase network limits (not expected in production)

These quirks are **environment-only** while the wallboard runs against the test VM and a manually copied `.xlsm`. They should go away once the kiosk is on **Office 365 + SharePoint** (calendar and files via Graph, jobs eventually from a shared location in M365 instead of a VM drag-drop folder).

| Where you are | What breaks | Why |
|---------------|-------------|-----|
| **Corporate network** (phone/tablet) | You generally **cannot use the mobile-friendly layout** — the test kiosk URL (`10.10.11.24:3001` or similar) is on the **plant/LAN**, not reachable from corp Wi‑Fi/VPN the same way. | Testing host is internal-only; not a bug in responsive CSS. On the wall kiosk itself you get the full desktop layout. |
| **PC dev build** (your laptop) | You **cannot open the live Operations Schedule file** the kiosk uses for auto-import (`vm-deploy` / `vm-fix` path under VMware drag-and-drop on the VM). | That path exists **on the kiosk VM**, not on your machine or corp file shares. Use **Projects → Import** in the browser with a local copy of the `.xlsm`, or run deploy/import **on the VM** via SSH/scripts. |
| **Production (planned)** | Calendar, SharePoint files, and job source tied to **O365** | No dependency on copying `.xlsm` into a VM cache folder; corp/mobile access follows normal M365 policies. |

**Cheesecake takeaway:** If something “works on the kiosk but not on my phone on corp network” or “I can’t find the spreadsheet path from my PC,” that’s expected in testing — don’t chase it as a code defect unless it still fails after O365 cutover.

---

## Stack

- **Backend:** Node.js + Express 4 + MSAL Node (Device Code Flow) + Microsoft Graph API + TypeScript
- **Frontend:** React 18 + Vite + Tailwind 3 + react-big-calendar + TanStack Query v5 + Zustand v4 + react-router-dom v6
- **Persistence:** plain JSON files in `server/data/` (no database)

---

## Run it locally (dev mode)

Two terminals:

```bash
cd server && npm run dev     # port 3001 (API)
cd client && npm run dev     # port 5173 (Vite, proxies /api -> 3001)
```

Open http://localhost:5173.

**For testing without Azure** (you almost always want this in dev): set `DISABLE_AZURE=true` in `server/.env`. This skips the device-code sign-in and uses mock data. The Project Board works regardless of Azure.

First-time setup:
```bash
cp .env.example .env   # in server/, then fill in values
```

---

## Production build

```bash
cd client && npm run build
cd server && npm run build
node server/dist/index.js    # serves client/dist as static on port 3001
```

---

## Deploy / update (one command, on the Linux kiosk)

Install:
```bash
curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

Update:
```bash
NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash
```

There's also a **weekly auto-update** (systemd timer `nexus-kiosk-updater.timer`, Sun 03:30) that runs `deploy/auto-update.sh`, which does a `git reset --hard` + rebuild. Both install and auto-update now run a connectivity preflight first and skip/abort cleanly when offline.

Active test VM: **10.10.11.24** (user `vrsi`, install `/home/vrsi/nexus-kiosk`). Gitea: **http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk** (was `briank/nexus-kiosk`). Home dev VM: Mint-VM-Proxmox.

### VM deploy from Windows (LAN/VPN)

```powershell
$env:VM_PASSWORD='…'   # never commit
python scripts/vm-deploy.py    # upload sources, npm build, restart backend+kiosk, curl full import
python scripts/vm-fix.py         # re-import only (parseXlsm + applyBoardImport)
python scripts/push-gitea.ps1  # git push gitea master to vrsi-pc-build/nexus-kiosk
```

Spreadsheet path on kiosk (VMware drag-drop):  
`/home/vrsi/.cache/vmware/drag_and_drop/DePM5V/Copy of Operations Schedule - Saved on - Active.xlsm`

**Landmine:** `vm-fix.py` used to call only `saveJobsFile` — that refreshed ship dates but **not** notes/status. Always use full import (`applyBoardImport` / UI Import / `vm-deploy` post-step).

**Landmine:** Port **3001** — stray `node /opt/tender/backend` has blocked Nexus; use `sudo fuser -k 3001/tcp` then `systemctl restart dashboard-backend`.

---

## Git remotes

| Remote | URL | Use |
|--------|-----|-----|
| `origin` | `https://github.com/soakal/nexus-kiosk.git` | Primary; `git push origin master` |
| `gitea` | `http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git` | Internal; `git push gitea master` (Gitea login when prompted) |

Web UI: http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk — migrated from `briank/nexus-kiosk`. If hostname fails on Windows, add `10.10.10.68 vrsi-git` to hosts.

---

## Azure setup (for the calendar half)

1. New App Registration, **no redirect URI**.
2. Authentication → **"Allow public client flows" = Yes** (REQUIRED for Device Code Flow).
3. API permissions (delegated): `Calendars.Read`, `User.Read`, `offline_access`, `Files.Read.All`, `Sites.Read.All`.
4. Copy tenant ID + client ID into `.env` (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`).

**Auth flow:** Device Code Flow. On first run the screen shows a code; you sign in at microsoft.com/devicelogin on your phone. Tokens are stored encrypted at `server/data/tokens.json` (gitignored), refreshed via direct OAuth2 refresh.

---

## How the Board / Jobs feature works

- Routes: `/board` (Projects), `/board/spare-parts`, `/board/archive`, `/board/users` (picker + colors), `/board/import` (XLSM import).
- **Import:** upload the `.xlsm`; server parses **"Active Projects"** (column **NOTE** → Ops Schedule notes; **Status** → checkmarks). PM values are lowercased on import. Spare carrier = `matto@vrs-inc.com`. Spare job = PM matches carrier **or** job number starts with `sp`.
- **`jobs.json`** — spreadsheet job rows only (no notes).
- **`board-state.json`** — `{ jobs: { "9201-016": { status, shipDateOverride, notes[], updatedAt } } }`. User notes + at most one `system:ops-schedule` note per job.
- **`board-config.json`** — colors, spare carrier, super user, extra users.
- Calendar ship-date events: `#job · PM`, click opens correct tab (`boardTab`: project / spare-parts / archive).
- `isNew` badge for jobs new since last import.

### Data directory — read this twice
**Everything persisted lives in `server/data/`.** All three services (tokenStore, configService, boardService) now resolve there consistently (a prior bug leaked token/config to `<root>/data`, un-gitignored). The five files — `tokens.json`, `config.json`, `jobs.json`, `board-state.json`, `board-config.json` — are **all gitignored and MUST stay that way.** The weekly `git reset --hard` will wipe any committed data file, destroying everyone's notes/status. This is the project's #1 landmine.

---

## Recently fixed (from the 2026-06 audit)

**Server**
- Data-dir path inconsistency — token/config now in `server/data` and gitignored.
- Atomic JSON writes (temp-file + rename) for board/config/token state — survives power-loss mid-write.
- Startup env validation: bootstrap() fails fast if `ENCRYPTION_SECRET` / `AZURE_*` missing (unless `DISABLE_AZURE=true`).
- CORS no longer defaults to `*`; `CORS_ORIGIN` is required in production.

**Client**
- StatusCheckboxes now honor user-configured status colors (was hardcoded to defaults).
- Unified spare-job classification so BoardHeader tab colors/counts match JobListView.

**Deploy**
- Fixed `local attempt=0` outside-a-function bug that broke every `NEXUS_UPDATE` run.
- Connectivity preflight (github / raw.githubusercontent / npm registry / nodesource) in install + auto-update; auto-update skips cleanly when offline.

**Repo hygiene**
- `logs/combined.log` + `logs/error.log` removed from git; `/logs/` and `*.log` added to `.gitignore`.

---

## Recently fixed (from the 2026-06 multi-agent review)

**Server / Import**
- Ship-date import: `detectColumns` was assigning wrong column for `shipToPm` (multiline header at index 8 matched `ship && pm` before the real col 12); fixed with contiguous `ship to pm` phrase + purch/review exclusion
- `parseDateValue` was returning raw garbage strings (TBD, N/A, Wk of 6/15) as real dates; now returns `null` for anything without a 4-digit year or that is unparseable
- `shipToCustomer` detection was brittle exact-match (`raw === 'ship from vrsi'`); widened to `includes`
- Import now tracks and returns `rowErrors` (missing job#, duplicate job#) + `skipped` count; import route logs via winston
- JSON import path changed from all-or-nothing 400 to partial import (only rejects when zero valid rows)
- `pruneOrphanedBoardState` now preserves entries with notes (silent permanent note-delete on re-import is fixed)
- `saveJobsFile` prune call routed through `runExclusive` so import serializes against concurrent note/status writes
- `writeJsonFile` now `fsync`s before rename and has try/finally cleanup of orphaned `.tmp` files
- Note IDs now use `crypto.randomUUID()` (was hrtime-based, could collide across restarts)

**Server / Auth / Deploy**
- `server/src/index.ts`: captures `http.Server`, adds `gracefulShutdown()` on SIGTERM/SIGINT with 10s force-exit fallback
- `/health` endpoint extended with `ready` field (true when token init is resolved one way or another, or test mode)
- `tokenRefresher.ts`: on transient init failure (not invalid_grant), schedules a 60s quick-retry instead of waiting 55 min for cron
- `auto-update.sh`: prefer `systemctl stop` before `fuser -k`; HTTP readiness poll after restart (12×5s, waits for `ready:true` on /health); pre-update backup call
- Feature A: `deploy/backup.sh` + `deploy/restore.sh` + `nexus-kiosk-backup.{service,timer}` added; backup runs every 6h, keeps 28 copies; wired into `install-linux.sh`

**Client**
- Import UI: amber partial-success banner with scrollable row-error list (was always green regardless of skipped rows)
- App.tsx: `/setup` redirect debounced — requires 4+ consecutive unauthenticated polls (~12s) before redirecting, preventing kiosk lock-out during server restart
- Calendar month-view: date-number dimming now gated on `!showWeekends` and uses `weekends-hidden` wrapper class instead of unconditional positional `nth-child` selectors
- AgendaRail redesigned: left time-column layout, colored accent bar, calendarName chip, "Now" badge for in-progress events, dated section headers
- Note mutation errors now surface via `console.error` in `onError` handlers

---

## Recently fixed (2026-06 kiosk session — commit 6f1894e)

**Import / board-state**
- `applyBoardImport()`: serializes status + Ops Schedule notes + `saveJobsFile` prune
- Spreadsheet **NOTE** column → one note per job (`authorName`: Ops Schedule, `authorId`: `system:ops-schedule`); user notes never removed on re-import
- Status: Cancelled skipped; Shipped → archive; Ready/Partially Shipped → `ready_to_ship`; Build/Parts on order/etc. → `in_progress`
- `mapSpreadsheetStatusToJobStatus()` shared by XLSM and JSON import paths

**Calendar**
- Removed `work_week` (weekend ship dates crashed week view); weekends-off uses Mon-start `week` + CSS clip (month + week)
- Calendar click uses `boardTab` → `/board/spare-parts?job=` etc.
- Ship events show **PM** in subject (`formatJobPmLabel`)

**Notes**
- `PATCH /api/board/jobs/:jobNumber/notes/:noteId` — author only
- Ops Schedule notes cannot be edited/deleted
- Inline error in `NotesSection` / `JobCard`

**Ops**
- `vm-deploy.py`: uploads board/calendar files, auto-import after deploy
- `vm-fix.py`: full import via `applyBoardImport`
- `scripts/push-gitea.ps1` — push to Gitea (`vrsi-pc-build/nexus-kiosk`)

---

## TODO backlog (remaining from the audit)

### High priority / correctness
- [ ] **Verify 401 self-recovery on VM after auto-update**: The client debounce (4 polls before /setup redirect) and server readiness poll in auto-update.sh are in place. Confirm on 10.10.11.24 after a real `NEXUS_UPDATE=1` run that the kiosk self-recovers without manual reboot. Adjust poll count if token refresh takes >15s.
- [ ] **Wire backup timer into NEXUS_UPDATE path**: `install-linux.sh` full-install enables `nexus-kiosk-backup.timer`. The `NEXUS_UPDATE=1` short-circuit does NOT re-install it. An existing VM running update-only won't get the 6-hourly timer until a full reinstall. Either add timer install to the update path or document that one full reinstall is required.
- [ ] **Scheduled XLSM auto-import**: No server-side cron yet. `vm-deploy.py` imports on manual deploy only. Add `node-cron` + configured path calling `applyBoardImport` (not `saveJobsFile` alone). `isNew` badge infra already built.
- [ ] **Upgrade `xlsx`** away from registry `0.18.5` — unpatched prototype-pollution (CVE-2023-30533) + ReDoS, and it parses **untrusted uploads** on the unauthenticated `/api/board/import`. Move to the SheetJS CDN build or an alternative.
- [x] **Validate the client-supplied jobs array** in `/import` — `validateJobsArray()` + 404 on unknown job for status/ship-date/notes. — DONE
- [x] **Serialize board-state read-modify-write** (mutation queue or per-job optimistic concurrency) — concurrent edits currently clobber each other (lost notes/status). — DONE (import path now serialized)
- [x] **`parseDateValue` timezone bug** — build dates from local Y/M/D components, not `toISOString().slice(0,10)`, to avoid off-by-one ship dates; also handle Excel error strings. — DONE (returns null for garbage, 4-digit year required)
- [x] **Guard `job.pm`** in `events.ts` so one bad job doesn't drop all board ship-date events. — DONE (per-job try/catch + type guards)
- [x] **Token-refresh resilience** — classify transient vs `invalid_grant`, add retry/backoff, and surface a visible "re-auth required" / TEST MODE state in the UI instead of failing silently. — DONE (60s quick retry on transient failure)
- [x] **Add `/api/*` 404 JSON handler** before the SPA `*` catch-all. — DONE (`server/src/index.ts`)
- [ ] **URL-encode interpolated Graph IDs** (siteId, driveId, calendarId, search) in `graph/sharepoint.ts` and `graph/events.ts`.
- [x] **Import orphan/isNew handling** — prune stale board-state entries on re-import; preserve `isNew` until acknowledged. — DONE (prune now preserves notes; isNew logic unchanged)
- [ ] **Auto-update.sh** — guard against missing/non-git `INSTALL_DIR` before cd/git; finite git transfer timeouts (`GIT_HTTP_LOW_SPEED_LIMIT/TIME`); defer `rm -rf node_modules` until npm reachability confirmed.

### Medium
- [ ] **Verify backup scripts on VM**: `backup.sh` / `restore.sh` / `nexus-kiosk-backup.timer` are in place but untested on the live VM (10.10.11.24). Verify: timer fires, archives appear under `/var/backups/nexus-kiosk/`, and `restore.sh latest` successfully stops → restores → restarts the backend.
- [x] **PM on calendar events** — subject is `#{jobNumber} · {PM}`; customer in agenda `bodyPreview`. — DONE (6f1894e)
- [ ] **"Completed" vs "Ready to Ship" label**: Spec says In Process / Completed / Shipped; app uses In Progress / Ready to Ship / Shipped. Change `statusLabel('ready_to_ship')` in `client/src/components/board/boardColors.ts` + `statusLabels` in `server/src/routes/events.ts` if the literal word "Completed" is required. No data model change.
- [ ] **Feature B (deferred): lightweight ADMIN_TOKEN gate**: When protection is needed, add `ADMIN_TOKEN` env var + ~20-line Express middleware on `POST /api/board/import`, `POST /api/board/config`, `POST /api/config`. No default credential. Use `x-admin-token` header (sidesteps CSRF). Land with `express-rate-limit`. Defer full RBAC until O365 identity arrives.
- [ ] **OneDrive offsite backup** (deferred until O365 integration): Once Graph creds exist, add `Files.ReadWrite.AppFolder` scope and a daily timer that pushes the newest local `board-*.tar.gz` to OneDrive `/Apps/NexusKioskBackups/`.
- [ ] Add a `validateEnv()` list-all-missing guard at the top of bootstrap() (clear exit-1 message).
- [ ] Gate `errorHandler` on `NODE_ENV` — generic 5xx messages in production, detailed in dev/4xx.
- [ ] Add rate limiting (`express-rate-limit`) — global + stricter on `/api/auth/start`; consider protecting the currently-unauthenticated `/api/board` and `/api/config`.
- [ ] Add a timeout/reject path in `startDeviceCodeFlow` so a pre-callback MSAL failure doesn't hang `POST /api/auth/start` forever; actually await/consume the completion promise so errors surface.
- [ ] Config cache invalidation in `configService` (cache never invalidated; shared mutable object aliases DEFAULT_CONFIG nested objects).
- [ ] Validate Open-Meteo response shape in `WeatherWidget` before reading nested arrays.
- [ ] Drop imperative `navigate()` in App's auth effect; rely on declarative `<Navigate>` guards (stops fighting react-router).
- [x] Type `useImportJobs` mutation TData/TError to remove unsafe `as` casts in `ImportView`. — DONE (boardApi.ts return types updated)
- [ ] Remove duplicate `isSuper`/`else` branch in `JobListView` tab filter; add `queryClient` to invalidate-effect deps.
- [ ] Coordinate JobCard Apply (single save or `Promise.all`) and surface save errors instead of silently re-syncing.
- [x] XLSM import: warn when "Active Projects" sheet or job-number column is missing. — DONE (rowErrors now reported)
- [x] Extend `/health` (or add `/ready`) to report authenticated / testMode / token-expiry. — DONE

### Low / polish
- [x] **Visible note-save error feedback** — `NotesSection` shows `actionError` from add/edit/delete mutations. — DONE (6f1894e)
- [x] **Server-side rowErrors truncation** — first 50 + summary; `rowErrorsTotal` in response. — DONE
- [ ] AES-256-GCM + random per-file salt in `tokenStore` (currently AES-256-CBC, unauthenticated, hardcoded salt).
- [x] `crypto.randomUUID()` for note IDs (hrtime-based IDs collide across restarts). — DONE
- [ ] De-dupe Ctrl+S / Ctrl+F handlers between App and Dashboard.
- [ ] Memoize NotesSection sort and AgendaRail today/tomorrow computation.
- [ ] Guard SettingsPanel `NumberField` against NaN / clamp to min/max; validate config numeric ranges server-side (startHour/endHour/refreshInterval/weatherLat/lon).
- [ ] `retry:false` on auth-status + presence polling queries (global default is `retry:3`).
- [ ] Extra-user remove: make case-insensitive or key by id (add is case-insensitive, remove is not).
- [ ] Replace array-index React keys (ImportView warnings) with stable keys.
- [ ] Replace magic 120ms scroll-restore timeout in JobListView with rAF/observer.
- [ ] Remove contradictory `defaultView` when CalendarView uses a controlled `view` prop.
- [ ] Fix off-by-one in `start-kiosk.sh` health-check loop (use an explicit READY flag); fix literal `$INSTALL_DIR` in uninstall prompt; add clone error handling to `deploy-to-vm.sh` heredoc.
- [x] Spare-parts detection: match `sp-` / `sp ` prefix, not any `sp*`. — DONE
- [x] `docs/azure-for-it-admin.md` exists (referenced by `.env.example`).
- [x] Top-level `README.md` + proprietary `LICENSE` (VRSI).

---

## Key architecture notes

- **No database.** State is JSON files in `server/data/` written atomically (temp-file + rename). Treat that directory as sacred (see landmine above).
- **Two independent halves:** the Graph/calendar side needs Azure + auth; the Project Board side needs neither. You can develop the board entirely with `DISABLE_AZURE=true`.
- **TypeScript both sides.** `npm run build` in server compiles to `server/dist`. The built server serves `client/dist` statically on port 3001 in production; in dev the Vite server on 5173 proxies `/api` to 3001.
- **Auth:** Device Code Flow via MSAL Node; encrypted token cache; direct OAuth2 refresh in `tokenRefresher.ts`.

---

## Gotchas (the stuff that will bite you)

1. **Never commit `server/data/*.json`.** The weekly `git reset --hard` (auto-update) will nuke any committed data file and erase everyone's board notes/status. They're gitignored — keep them that way.
2. **Always `DISABLE_AZURE=true` in dev/test.** No SharePoint/O365 access in the testing environment.
3. **Server won't start in production without `CORS_ORIGIN` and `ENCRYPTION_SECRET`** (and `AZURE_*` unless `DISABLE_AZURE=true`). This is intentional fail-fast behavior, not a bug.
4. **`xlsx@0.18.5` is a known-vuln dependency parsing untrusted uploads** — top of the security TODO; don't add features on top of it without flagging.
5. **Git remotes:** `origin` = GitHub only. `gitea` = `http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git` (was `briank/nexus-kiosk`). Push both: `git push origin master` then `git push gitea master` (on LAN; Gitea credentials required).
6. **Import vs deploy:** Code deploy does not update notes/checkmarks — run **Projects → Import** or `vm-deploy`/`vm-fix` full import after deploy.
7. **Model usage convention on this project:** Opus for planning, Sonnet for coding.
8. **Logs:** written under `server/logs/` (and `/logs/`); both are gitignored now. Don't re-add log files to git.

Good luck, Cheesecake. Start with the board — it's the most-used surface and the audit TODOs there are the highest-leverage.
