# Handoff to Cheesecake 🧀

Welcome aboard! This is **Nexus Kiosk** (a.k.a. the VRSI Wallboard). This doc gets you from zero to productive. Read CLAUDE.md too — it's the short-form source of truth.

---

## What the app does

A self-hosted wall dashboard that runs full-screen in Chromium kiosk mode on a Linux box mounted on the wall. Two big features:

1. **Calendar / SharePoint** — pulls a Microsoft 365 calendar (and SharePoint files) via the Microsoft Graph API and shows it on a `react-big-calendar` view with a weather widget and agenda rail.
2. **Project Board ("Projects")** — a self-contained job-tracking board at `/board`. No Azure/auth needed; the user is chosen from a picker. Jobs are imported from an `.xlsm` spreadsheet ("Active Projects" sheet), and people add notes / set status / set ship dates per job. This is the part people touch every day.

Currently in a **testing phase**. No live SharePoint/O365 access in dev — always run with `DISABLE_AZURE=true` locally.

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

Active test VM: **10.10.11.24** (user `vrsi`). Home dev VM: Mint-VM-Proxmox.

---

## Azure setup (for the calendar half)

1. New App Registration, **no redirect URI**.
2. Authentication → **"Allow public client flows" = Yes** (REQUIRED for Device Code Flow).
3. API permissions (delegated): `Calendars.Read`, `User.Read`, `offline_access`, `Files.Read.All`, `Sites.Read.All`.
4. Copy tenant ID + client ID into `.env` (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`).

**Auth flow:** Device Code Flow. On first run the screen shows a code; you sign in at microsoft.com/devicelogin on your phone. Tokens are stored encrypted at `server/data/tokens.json` (gitignored), refreshed via direct OAuth2 refresh.

---

## How the Board / Jobs feature works

- Routes: `/board` (Projects), `/board/spare-parts`, `/board/users` (picker + per-user colors), `/board/import` (XLSM import).
- **Import:** upload the `.xlsm`; the server parses the **"Active Projects"** sheet. PM values are lowercase emails. Spare-parts carrier = `matto@vrs-inc.com`. A job counts as "spare" if its PM is the spare carrier **or** its job number has the spare prefix (e.g. `SP-`).
- **Per-job state** (notes, status, ship-date overrides) lives in `board-state.json`, keyed by job number. Jobs themselves live in `jobs.json`. Board config (colors, etc.) in `board-config.json`.
- The board re-serves ship dates as calendar events too.
- `isNew` badge exists for jobs added on (re-)import — relevant to the planned auto-pull of the spreadsheet from a file server.

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

## TODO backlog (remaining from the audit)

### High priority / correctness
- [ ] **Upgrade `xlsx`** away from registry `0.18.5` — unpatched prototype-pollution (CVE-2023-30533) + ReDoS, and it parses **untrusted uploads** on the unauthenticated `/api/board/import`. Move to the SheetJS CDN build or an alternative.
- [ ] **Validate the client-supplied jobs array** in `/import` (and the manual-JSON import path) — currently trusts `Job[]` verbatim and re-serves it as events. Add a 404/guard for status/note/ship-date on unknown job numbers.
- [ ] **Serialize board-state read-modify-write** (mutation queue or per-job optimistic concurrency) — concurrent edits currently clobber each other (lost notes/status).
- [ ] **`parseDateValue` timezone bug** — build dates from local Y/M/D components, not `toISOString().slice(0,10)`, to avoid off-by-one ship dates; also handle Excel error strings.
- [ ] **Guard `job.pm`** in `events.ts` so one bad job doesn't drop all board ship-date events.
- [ ] **Token-refresh resilience** — classify transient vs `invalid_grant`, add retry/backoff, and surface a visible "re-auth required" / TEST MODE state in the UI instead of failing silently.
- [ ] **Add `/api/*` 404 JSON handler** before the SPA `*` catch-all (unknown API routes currently return index.html / 200 HTML).
- [ ] **URL-encode interpolated Graph IDs** (siteId, driveId, calendarId, search) in `graph/sharepoint.ts` and `graph/events.ts`.
- [ ] **Import orphan/isNew handling** — prune stale board-state entries on re-import; preserve `isNew` until acknowledged.
- [ ] **Auto-update.sh** — guard against missing/non-git `INSTALL_DIR` before cd/git; finite git transfer timeouts (`GIT_HTTP_LOW_SPEED_LIMIT/TIME`); defer `rm -rf node_modules` until npm reachability confirmed.

### Medium
- [ ] Add a `validateEnv()` list-all-missing guard at the top of bootstrap() (clear exit-1 message).
- [ ] Gate `errorHandler` on `NODE_ENV` — generic 5xx messages in production, detailed in dev/4xx.
- [ ] Add rate limiting (`express-rate-limit`) — global + stricter on `/api/auth/start`; consider protecting the currently-unauthenticated `/api/board` and `/api/config`.
- [ ] Add a timeout/reject path in `startDeviceCodeFlow` so a pre-callback MSAL failure doesn't hang `POST /api/auth/start` forever; actually await/consume the completion promise so errors surface.
- [ ] Config cache invalidation in `configService` (cache never invalidated; shared mutable object aliases DEFAULT_CONFIG nested objects).
- [ ] Validate Open-Meteo response shape in `WeatherWidget` before reading nested arrays.
- [ ] Drop imperative `navigate()` in App's auth effect; rely on declarative `<Navigate>` guards (stops fighting react-router).
- [ ] Type `useImportJobs` mutation TData/TError to remove unsafe `as` casts in `ImportView`.
- [ ] Remove duplicate `isSuper`/`else` branch in `JobListView` tab filter; add `queryClient` to invalidate-effect deps.
- [ ] Coordinate JobCard Apply (single save or `Promise.all`) and surface save errors instead of silently re-syncing.
- [ ] XLSM import: warn when "Active Projects" sheet or job-number column is missing.
- [ ] Extend `/health` (or add `/ready`) to report authenticated / testMode / token-expiry.

### Low / polish
- [ ] AES-256-GCM + random per-file salt in `tokenStore` (currently AES-256-CBC, unauthenticated, hardcoded salt).
- [ ] `crypto.randomUUID()` for note IDs (hrtime-based IDs collide across restarts).
- [ ] De-dupe Ctrl+S / Ctrl+F handlers between App and Dashboard.
- [ ] Memoize NotesSection sort and AgendaRail today/tomorrow computation.
- [ ] Guard SettingsPanel `NumberField` against NaN / clamp to min/max; validate config numeric ranges server-side (startHour/endHour/refreshInterval/weatherLat/lon).
- [ ] `retry:false` on auth-status + presence polling queries (global default is `retry:3`).
- [ ] Extra-user remove: make case-insensitive or key by id (add is case-insensitive, remove is not).
- [ ] Replace array-index React keys (ImportView warnings) with stable keys.
- [ ] Replace magic 120ms scroll-restore timeout in JobListView with rAF/observer.
- [ ] Remove contradictory `defaultView` when CalendarView uses a controlled `view` prop.
- [ ] Fix off-by-one in `start-kiosk.sh` health-check loop (use an explicit READY flag); fix literal `$INSTALL_DIR` in uninstall prompt; add clone error handling to `deploy-to-vm.sh` heredoc.
- [ ] Spare-parts detection: match `sp-` prefix specifically, not any `sp*`.
- [ ] Create `docs/azure-for-it-admin.md` (referenced by `.env.example`) or fix the dangling reference.
- [ ] Write a top-level `README.md` (none exists).

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
5. **Git remotes:** `origin` pushes to GitHub `soakal/nexus-kiosk`. A `gitea` remote still exists but its push is currently disabled (TODO to re-add).
6. **Model usage convention on this project:** Opus for planning, Sonnet for coding.
7. **Logs:** written under `server/logs/` (and `/logs/`); both are gitignored now. Don't re-add log files to git.

Good luck, Cheesecake. Start with the board — it's the most-used surface and the audit TODOs there are the highest-leverage.
