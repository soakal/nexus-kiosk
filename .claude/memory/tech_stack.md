---
name: tech-stack
description: Nexus Kiosk technology choices
metadata:
  type: project
---

# Tech Stack

## Backend
- **Runtime:** Node.js 18+ with TypeScript (ESM)
- **Server:** Express 4
- **Dev runner:** tsx (for `.ts` entry points)
- **Auth:** @azure/msal-node v2 PublicClientApplication — Device Code Flow
- **Token refresh:** Direct POST to `/oauth2/v2.0/token` (NOT MSAL silent flow — unreliable after process restart)
- **Graph:** @microsoft/microsoft-graph-client v3 (authenticated with Bearer token)
- **Config storage:** Encrypted JSON file (server/data/tokens.json, server/data/config.json)
- **Task scheduling:** node-cron for auto-refresh every 55 min

## Frontend
- **Framework:** React 18
- **Build tool:** Vite 5 (dev server proxies /api to Express)
- **Styling:** Tailwind CSS 3
- **Calendar:** react-big-calendar
- **Data fetching:** TanStack Query v5 (@tanstack/react-query)
- **State:** Zustand v4
- **Auth state:** Persisted in localStorage; device code flow polling

## Deployment
- **Target:** Linux (Ubuntu 22.04+ or Raspberry Pi OS Bookworm)
- **Kiosk:** Chromium --kiosk flag
- **Service manager:** systemd (two units: nexus-server + nexus-kiosk)
- **Process manager:** Node native or systemd
- **Production serving:** Express serves client/dist as static + API routes on same port (3001)

## Key decisions
- Device Code Flow: no client secret, works on kiosk without browser redirect
- Direct OAuth2 refresh: MSAL silent flow is unreliable when process restarts; direct POST with refresh_token is robust
- Encrypted tokens: AES-256-CBC with scrypt-derived key
- Monorepo with npm workspaces: shared tooling, single install
