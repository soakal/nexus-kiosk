# Azure Setup Guide for IT Administrators

## Section 1: What This Is (Plain English)

The VRSI Dashboard displays Microsoft 365 calendars and SharePoint files on a wall-mounted TV screen inside the office. It needs a one-time App Registration in your Azure tenant so it can securely read calendar data.

**Privacy & Security — what this app does and does NOT do:**
- ✅ Reads calendar events and SharePoint files from your own Microsoft 365 tenant
- ✅ Runs entirely on your local network — no cloud hosting, no external servers
- ✅ Read-only access only — it cannot create, edit, or delete anything
- ❌ Does **not** send any data to AI services, OpenAI, Anthropic, or any third party
- ❌ Does **not** connect to any external APIs except Microsoft's own Graph API and Open-Meteo (weather, public data only)
- ❌ Does **not** store data outside your own network — tokens are encrypted on the local machine

Setup takes about 5 minutes and requires no ongoing IT involvement.

## Section 2: Email Template for IT

---

**Subject:** App Registration Request - VRSI Wall Dashboard

Hi [IT Team],

We are setting up a wall-mounted TV display in the office that shows our Microsoft 365 calendar and SharePoint files. It is a read-only display that runs entirely on our local network — no data is sent to any external AI services or third parties. It only communicates with Microsoft's own Graph API to read our internal calendar and file data, the same way Outlook does.

Could you create an Azure App Registration with these specs?

**App Details:**
- **App name:** VRSI Wall Dashboard
- **Supported account types:** Single tenant (this organization only)
- **Public client app:** Yes (no client secret, no redirect URI needed)
- **Authentication flow:** Device Code Flow (user signs in once on their phone)
- **Allow public client flows:** Yes (critical — must be enabled)

**API Permissions needed (Delegated, read-only):**
- Calendars.Read — display calendar events on the wall screen
- User.Read — show the signed-in user's name
- offline_access — keep the display signed in without daily prompts
- Files.Read.All — show recent SharePoint files on the display
- Sites.Read.All — browse SharePoint document libraries

**What this app does NOT do:**
- Does not send any data to AI services, OpenAI, Anthropic, or any third party
- Does not write, create, edit, or delete any calendar events or files
- Does not transmit data outside the company network
- Does not store credentials — it uses Microsoft's own secure token system

Once created, please send me:
- Directory (Tenant) ID
- Application (Client) ID

Happy to answer any questions. Thanks!

---

## Section 3: IT Step-by-Step Instructions

### Step 1: Start a New Registration
1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for and open **Microsoft Entra ID**
3. Click **App registrations** in the left sidebar
4. Click **New registration**

### Step 2: Register the App
1. **Name:** Enter `VRSI Wall Dashboard`
2. **Supported account types:** Select `Single tenant` (this organization only)
3. **Redirect URI:** Leave blank (not needed for public clients)
4. Click **Register**

### Step 3: Capture the IDs
1. You're now on the app's **Overview** page
2. Copy the **Directory (tenant) ID** — this is your `AZURE_TENANT_ID`
3. Copy the **Application (client) ID** — this is your `AZURE_CLIENT_ID`
4. Save these somewhere safe to send to the user

### Step 4: Enable Public Client Flows (CRITICAL)
1. Click **Authentication** in the left sidebar
2. Scroll down to **Advanced settings**
3. Set **Allow public client flows** to **Yes**
4. Click **Save** at the bottom
5. This setting is required for Device Code Flow to work

### Step 5: Add API Permissions
1. Click **API permissions** in the left sidebar
2. Click **Add a permission**
3. Choose **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and check these scopes (one at a time or all at once):
   - `Calendars.Read`
   - `User.Read`
   - `offline_access`
   - `Files.Read.All`
   - `Sites.Read.All`
6. Click **Add permissions**
7. Back on the API permissions page, click **Grant admin consent for [Your Organization]**
8. Confirm the popup

### Step 6: Send the IDs to the User
Email the user the two IDs from Step 3:
- Directory (Tenant) ID
- Application (Client) ID

## Section 4: What To Do With The IDs

Once you have the two IDs from IT:

1. Open the `.env` file in your Nexus Kiosk project directory
2. Paste the **Directory (Tenant) ID** into `AZURE_TENANT_ID`
3. Paste the **Application (Client) ID** into `AZURE_CLIENT_ID`
4. Save the file
5. Restart the application

Example:
```
AZURE_TENANT_ID=12345678-1234-1234-1234-123456789012
AZURE_CLIENT_ID=87654321-4321-4321-4321-210987654321
```

## Section 5: Personal Account Alternative

If you have a personal @outlook.com or @microsoft.com account, you can set this up yourself without involving IT:

1. Go to [portal.azure.com](https://portal.azure.com)
2. Sign in with your personal Microsoft account
3. Follow Steps 1–6 above (you'll be your own IT admin)
4. You'll grant consent to yourself

This works great for testing or small deployments, though IT-managed accounts are preferred for production environments.
