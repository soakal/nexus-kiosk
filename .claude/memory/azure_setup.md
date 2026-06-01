---
name: azure-setup
description: Azure App Registration required for Nexus Kiosk
metadata:
  type: project
---

# Azure App Registration Setup

## Application Type
- Public client app (NO client secret needed)
- No redirect URI required
- Device Code Flow is the grant type used

## Critical Azure Configuration

### Authentication tab
- Allow public client flows: YES (required for Device Code grant type)
- Without this, Device Code Flow will fail with AADSTS7000218 error
- Located in: App Registration > Authentication > Advanced Settings
- Supported account types: Multitenant recommended for shared kiosks

### API Permissions (Graph scopes)
Add delegated permissions:
- Calendars.Read — read calendar events
- User.Read — read user profile
- offline_access — issue refresh token (REQUIRED for auto-refresh)
- Files.Read.All — read all files in OneDrive + SharePoint
- Sites.Read.All — read SharePoint site metadata

Admin consent may be required; request in Azure or via Device Code flow.

## Environment Variables

Copy from Azure Portal:
- AZURE_TENANT_ID: Directory ID (UUID format)
  - Path: App Registration > Overview > Directory (tenant) ID
- AZURE_CLIENT_ID: Application ID (UUID format)
  - Path: App Registration > Overview > Application (client) ID

## Testing Device Code Flow

Start server:
  npm run dev --workspace=server

Call device code endpoint:
  curl -X POST http://localhost:3001/api/auth/device-code

Response:
  {
    "userCode": "ABCD1234",
    "verificationUri": "https://microsoft.com/devicelogin",
    "expiresIn": 900
  }

Open verification URI and sign in with your tenant account; enter user code.
Server will poll and complete auth.

## Troubleshooting

- AADSTS7000218: "The request body must contain the following parameter: 'client_assertion' or 'client_secret'"
  Cause: Public client flows disabled in Authentication
  Fix: Enable "Allow public client flows" = Yes

- AADSTS65001: "User or admin has not consented to use the application"
  Cause: Scopes require admin consent
  Fix: Request consent in Device Code flow OR admin pre-consents in Azure

- AADSTS9002326: "Back channel logout is not supported for this application"
  Safe to ignore; means app doesn't support logout notification webhooks

## Production Considerations

- Register app in production Azure tenant (not developer/trial)
- Use service account or dedicated user; Device Code Flow is per-user
- Store ENCRYPTION_SECRET in Linux environment (systemd service file or /etc/nexus/.env)
- Regenerate ENCRYPTION_SECRET annually for rotation
- Monitor token refresh logs; refresh failures are non-blocking but should be investigated
