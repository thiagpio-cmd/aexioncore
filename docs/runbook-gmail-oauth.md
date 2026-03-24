# Aexion Core — Gmail OAuth Provisioning Runbook

## Overview
Aexion Core utilizes a multi-tenant integration architecture. Before any tenant can connect their Gmail account natively, the platform administrator must provision an OAuth 2.0 Web Client Application within the Google Cloud Console. 

This runbook outlines the exact steps required to provision the Google Cloud environment for Local, Staging, and Production deployments.

---

## 1. Google Cloud Configuration (Universal Steps)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Google Cloud Project (e.g., `Aexion Core Integrations`).
3. Open the navigation menu and go to **APIs & Services > Library**.
4. Search for and **Enable** the **Gmail API**.
5. Go back to **APIs & Services > OAuth consent screen**.
6. Choose the User Type: 
   - *Internal*: Only for testing within your Google Workspace organization.
   - *External*: Required if your pilot tenants use their own generic @gmail.com or external workspace accounts. (Note: External apps eventually require a security review if you request sensitive scopes).
7. Fill out the application details (Name: `Aexion Core`).
8. Add the following **Required Scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/userinfo.email`
9. Add test users if you remained in "Testing" mode. Save and continue.

---

## 2. Environment-Specific Provisioning

You must create separate "OAuth 2.0 Client IDs" (Web Application) for each environment to prevent redirect URL cross-contamination.

Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID > Web application**.

### A. Local Development (localhost)
- **Name:** Aexion Core - Local
- **Authorized JavaScript Origins:** `http://localhost:3000`
- **Authorized Redirect URIs:** 
  - `http://localhost:3000/api/integrations/gmail/callback`
- **Action:** Copy the Client ID and Client Secret into your local `aexion-core/.env.local`:
  ```env
  GOOGLE_CLIENT_ID="your-local-client-id"
  GOOGLE_CLIENT_SECRET="your-local-client-secret"
  ```
- *Aexion Core handles missing variables locally by disabling the "Connect" UI natively.*

### B. Staging / Homologation
- **Name:** Aexion Core - Staging
- **Authorized JavaScript Origins:** `https://staging.aexion.io` *(replace with actual URL)*
- **Authorized Redirect URIs:** 
  - `https://staging.aexion.io/api/integrations/gmail/callback`
- **Action:** Mount the variables inside the Vercel/Docker environment for your staging orchestrator.

### C. Production / Pilot
- **Name:** Aexion Core - Production
- **Authorized JavaScript Origins:** `https://app.aexion.io` *(replace with actual URL)*
- **Authorized Redirect URIs:** 
  - `https://app.aexion.io/api/integrations/gmail/callback`
- **Action:** Mount the variables in your production orchestrator vault.
- **Critical Note for Production:** Because Aexion Core consumes `gmail.readonly` and `gmail.send`, Google categorizes this as a Restricted Scope App. Before opening the product to the general public, you will need to submit a YouTube video explaining the OAuth flow to Google for verification.

---

## 3. Post-Provisioning Verification
1. Reboot the Next.js server so `process.env` picks up the new IDs.
2. Navigate horizontally as a Tenant Admin to the `/integrations` domain.
3. The "Configuration Required" warning over Gmail should automatically vanish.
4. Click "Connect", authorize the scopes, and observe the database mapping the returned tokens to the `IntegrationCredential` table for your tenant.
