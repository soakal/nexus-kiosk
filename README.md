# Nexus Kiosk

Self-hosted wall dashboard: Microsoft 365 calendar, SharePoint files, and an operations **Project Board** (jobs from Excel, notes, ship-date workflow).

**License:** Private and proprietary — see [LICENSE](LICENSE). Copyright © VRSI. All rights reserved.

## Quick start

```bash
cp server/.env.example server/.env   # set DISABLE_AZURE=true for local dev
cd server && npm run dev             # API :3001
cd client && npm run dev             # UI  :5173
```

Open http://localhost:5173 — board works without Azure.

## Docs

| File | Purpose |
|------|---------|
| [CLAUDE.md](CLAUDE.md) | Concise ops reference (deploy, data files, import rules, VM) |
| [HANDOFF-CHEESECAKE.md](HANDOFF-CHEESECAKE.md) | Full onboarding, TODO backlog, architecture |

## Production / kiosk

```bash
cd client && npm run build && cd ../server && npm run build
node server/dist/index.js
```

Linux install/update: see `deploy/install-linux.sh` in [CLAUDE.md](CLAUDE.md).

Work VM: `vrsi@10.10.11.24`, install `/home/vrsi/nexus-kiosk`.

| Script | Purpose |
|--------|---------|
| `scripts/vm-deploy.py` | Upload changed sources, build, restart, auto-import |
| `scripts/vm-fix.py` | Re-run full spreadsheet import on VM |
| `scripts/push-gitea.ps1` | `git push gitea master` (LAN) |

## Git

- **GitHub:** `git push origin master`
- **Gitea (LAN):** `git push gitea master` — remote `http://10.10.10.68:3000/briank/nexus-kiosk.git`
