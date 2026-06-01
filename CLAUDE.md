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

## Linux deploy
  bash deploy/install-linux.sh
