---
name: project-overview
description: Nexus Kiosk project goals and current state
metadata:
  type: project
---

# Nexus Kiosk Project Overview

Nexus Kiosk replaces Dakboard. Started June 2026. GitHub: https://github.com/soakal/nexus-kiosk

## What it does
- Displays M365 calendar events, SharePoint files, weather, live clock, next-event countdown
- Runs on Linux (Raspberry Pi or Ubuntu) in Chromium kiosk mode, unattended 24/7
- Auth: one-time Device Code Flow setup; tokens persist encrypted; auto-refresh every 55 min
- Self-hosted Dakboard alternative with native M365 integration

## Architecture
Monorepo: `server/` (Node.js + Express) + `client/` (React + Vite)
Entry point: `server/src/index.ts` (Express server)
Client: `client/src/main.tsx` (React app)

## Key Features (MVP)
1. M365 authentication via Device Code Flow
2. Calendar events display (react-big-calendar)
3. SharePoint file picker and display
4. Real-time clock and next-event countdown
5. Encrypted token storage with auto-refresh
6. Linux systemd kiosk deployment

## Current Status
- Core auth + token refresh implemented
- API endpoints for calendar, files, weather sketched
- React frontend with device code screen
- Deployment script pending
