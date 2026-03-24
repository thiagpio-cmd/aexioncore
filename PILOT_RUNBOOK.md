# Aexion Core — Pilot Deployment Runbook

## Prerequisites

- Node.js 24+ with nvm
- pnpm installed
- SQLite (default dev database)
- Google Cloud Project with Gmail API enabled
- OAuth consent screen configured with test users

## Environment Setup

```bash
# Clone and install
git clone <repo>
cd aexion-core
pnpm install

# Environment variables (.env.local)
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="<generate-32-char-secret>"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="<from-google-cloud-console>"
GOOGLE_CLIENT_SECRET="<from-google-cloud-console>"
NODE_ENV="development"
```

## Database Setup

```bash
pnpm prisma db push
pnpm db:seed
```

Verify: 25+ tables created, 100+ seed records.

## Start Application

```bash
pnpm dev
# App available at http://localhost:3000
```

## Initial Login

- URL: http://localhost:3000/login
- Credentials: ana@aexion.io / aexion123
- Role: ADMIN (required for integrations and setup)

## Tenant Setup

1. Navigate to /setup
2. Step 1: Set display name and primary color
3. Step 2: Select industry and currency
4. Step 3: Enable/disable modules
5. Complete setup

## Gmail Integration

### Google Cloud Console Setup
1. Create project at console.cloud.google.com
2. Enable Gmail API
3. Configure OAuth consent screen (External, test mode)
4. Add test users (the Gmail account to connect)
5. Create OAuth Client ID (Web application)
6. Set redirect URI: `http://localhost:3000/api/integrations/callback/gmail`

### Connect Gmail
1. Navigate to /integrations
2. Click "Connect" on Gmail card
3. Complete OAuth consent in browser
4. Verify: status shows CONNECTED, healthPercent 100

### First Sync
1. Click "Sync Now" on integration detail page
2. Verify: green "Sync completed successfully" banner
3. Navigate to /inbox — real Gmail messages visible

### Entity Linking
- Messages auto-link to CRM contacts by sender email
- After adding new contacts, call POST /api/integrations/relink to re-process
- Linked messages appear in lead/opportunity timelines

## Operational Notes

### Token Lifecycle
- Access tokens expire in ~1 hour
- Automatic refresh attempted on sync if refresh token exists
- If refresh fails: integration shows error, reconnection required

### Known Limitations
- SQLite for dev only (not concurrent-safe)
- No webhook/push notifications (requires public domain)
- AI suggestions are static templates
- Token refresh tested in code but not validated with expired real token

### Error States
| Error | Meaning | Action |
|-------|---------|--------|
| "Token refresh failed" | Google rejected refresh | Disconnect and reconnect |
| "Token expired, no refresh token" | Missing refresh token | Reconnect with prompt=consent |
| "Credentials corrupted" | Decryption failed | Reconnect |
| "Insufficient permissions" | Wrong scopes | Re-authorize with correct scopes |
| "Sync timed out" | Large mailbox | Retry later |

### Health Monitoring
- Integration health at /integrations/{id}
- Health engine checks: token validity, API access, consecutive failures

## Test Users (Seed Data)

| Email | Role | Password |
|-------|------|----------|
| ana@aexion.io | ADMIN | aexion123 |
| lucas@aexion.io | CLOSER | aexion123 |
| camila@aexion.io | MANAGER | aexion123 |
| rafael@aexion.io | SDR | aexion123 |

## Support Checklist

- [ ] .env.local configured with all required variables
- [ ] Database seeded and accessible
- [ ] Gmail OAuth credentials valid
- [ ] Test user added to Google OAuth consent screen
- [ ] Redirect URI matches: http://localhost:3000/api/integrations/callback/gmail
- [ ] Dev server running on port 3000
