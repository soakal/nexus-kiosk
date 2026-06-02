# Nexus Kiosk

Self-hosted wall dashboard: Microsoft 365 calendar + SharePoint files. Runs on Linux in Chromium kiosk.

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
1. cp .env.example .env && fill in Azure credentials
2. Start server + client dev servers
3. Open http://localhost:5173 — shows device code screen
4. Sign in at microsoft.com/devicelogin on your phone

## Linux deploy (one command)
  curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash

## Linux update (one command)
  NEXUS_UPDATE=1 curl -fsSL https://raw.githubusercontent.com/soakal/nexus-kiosk/master/deploy/install-linux.sh | sudo bash

## Project Board ("Projects")
Self-contained job-tracking feature at the `/board` route. No Graph API / no auth required (user is chosen via a picker).
Tabs/routes: `/board` (Project), `/board/spare-parts` (Spare Parts), `/board/users` (Users — picker + colors), `/board/import` (Import — XLSM import).
Data persisted in server/data/{jobs,board-state,board-config}.json.
WARNING: these three files MUST stay gitignored. deploy/auto-update.sh does a weekly `git reset --hard` (Sun 03:30 via nexus-kiosk-updater.timer); if any board data file is ever committed, the next update wipes all board notes/status. They are currently gitignored — keep them that way.

## Data directory (IMPORTANT)
All persisted state lives in `server/data/`. tokenStore.ts, configService.ts, and boardService.ts now ALL resolve to the same `server/data` dir (previously token/config leaked to `<root>/data` and were NOT gitignored). Files: tokens.json, config.json, jobs.json, board-state.json, board-config.json — all gitignored.

## Env vars (validated at startup)
Server fails fast in bootstrap() if required vars are missing. Required: ENCRYPTION_SECRET, and (unless DISABLE_AZURE=true) AZURE_TENANT_ID + AZURE_CLIENT_ID. CORS_ORIGIN is REQUIRED in production — server refuses to start without it and never falls back to '*'. See .env.example for the full list. Testing/no-Azure runs: set DISABLE_AZURE=true.

## Connectivity checks (deploy scripts)
install-linux.sh and auto-update.sh now run a connectivity preflight (github.com, raw.githubusercontent.com, registry.npmjs.org, deb.nodesource.com) before any network op. auto-update.sh skips the run (exit 0) when offline so the weekly unattended update never strands the kiosk. git/npm/apt steps are guarded with clear failure messages.

## Recently fixed (audit 2026-06)
- Data-dir path inconsistency (token/config now in server/data, gitignored)
- Atomic JSON writes (temp-file + rename) for board/config/token state
- Startup env validation; CORS no longer defaults to '*'
- Status-checkbox colors honor user-configured palette; unified spare-job classification (BoardHeader vs JobListView)
- Deploy: `local attempt=0` bug fixed; connectivity preflight + guarded network steps
- logs/*.log removed from git and ignored (/logs/ + *.log in .gitignore)
See HANDOFF-CHEESECAKE.md for the remaining audit TODO backlog.
