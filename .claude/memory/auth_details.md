---
name: auth-details
description: Authentication and token lifecycle in Nexus Kiosk
metadata:
  type: project
---

# Authentication & Token Lifecycle

## Initial Setup (Device Code Flow)

1. **Frontend:** On app load, checks localStorage for `deviceCodeFlow` state
   - If missing or expired, shows device code screen
   - Calls `POST /api/auth/device-code` to get user code + verification URI

2. **Backend (initializeAuth):**
   - Creates PublicClientApplication with tenant + client ID
   - Calls `acquireTokenByDeviceCode()` with device code from frontend
   - MSAL polls Azure until user signs in at microsoft.com/devicelogin

3. **Token storage:**
   - Upon success, server encrypts tokens with AES-256-CBC
   - Key: `scryptSync(ENCRYPTION_SECRET, 'nexus-kiosk-salt', 32)`
   - Stores in `server/data/tokens.json`: `{ accessToken, refreshToken, expiresOn }`
   - Frontend localStorage: `{ deviceCodeFlow: true, userId: "...", email: "..." }`

## Token Refresh (Every 55 Minutes)

- **Server:** node-cron job runs `refreshTokens()` at 55-min interval
- **Method:** Direct POST to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  - Body: `grant_type=refresh_token&client_id=...&refresh_token=...&scope=...`
  - Returns new `access_token` + (optionally) new `refresh_token`
- **Why direct:** MSAL silent flow (`acquireTokenSilent`) unreliable after process restart; direct POST is stateless + robust
- **On failure:** Logs error; next refresh attempt at 55 min; frontend unaffected until access token actually expires

## On Process Restart

1. `initializeTokens()` runs before Express listen
2. Reads encrypted `tokens.json`; decrypts
3. Calls `refreshTokens()` immediately (don't wait for cron)
4. Starts cron scheduler for ongoing 55-min refresh
5. If decryption/refresh fails: clears tokens, logs error, frontend will show device code screen

## Checking Authentication Status

- **Frontend:** `localStorage.deviceCodeFlow === true` (volatile, may not survive page reload)
- **Backend:** `isAuthenticated()` returns true if accessToken exists + not expired
  - Called by protected endpoints; returns 401 if false
  - Triggers device code flow on frontend

## Graph API Calls

- All requests include `Authorization: Bearer {accessToken}`
- Handled by `@microsoft/microsoft-graph-client` after initialization with auth provider
- Calls must respect M365 scopes: `Calendars.Read`, `User.Read`, `Files.Read.All`, `Sites.Read.All`

## Security notes

- Never log access tokens; only log `refreshToken` existence
- ENCRYPTION_SECRET must be 64+ chars (hex string recommended)
- Token file (`server/data/tokens.json`) should be 600 perms on Linux, never committed
- Device code login is public-facing; only valid for ~10 min; safe to show on kiosk screen
