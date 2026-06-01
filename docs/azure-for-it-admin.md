# Azure Setup Guide for IT Administrators

## Section 1: What This Is (Plain English)

The Nexus Kiosk dashboard displays shared Microsoft 365 calendars on wall displays. It needs a one-time App Registration in your Azure tenant so it can securely read calendar data. Setup takes about 5 minutes, requires read-only permissions only, and no data leaves your company—everything runs locally on your network.

## Section 2: Email Template for IT

---

**Subject:** App Registration Request - VRSI Wall Dashboard

Hi [IT Team],

We need a quick App Registration in Azure for our wall dashboard application. Could you create one with these specs?

**App Details:**
- **App name:** VRSI Wall Dashboard
- **Supported account types:** Single tenant
- **Public client app:** Yes (no client secret, no redirect URI needed)
- **Authentication flow:** Device Code Flow
- **Allow public client flows:** Yes (critical setting)

**API Permissions (Delegated):**
- Calendars.Read
- User.Read
- offline_access
- Files.Read.All
- Sites.Read.All

Once created, please send us:
- Directory (Tenant) ID
- Application (Client) ID

Thanks!

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
