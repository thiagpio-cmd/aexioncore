/**
 * Settings > Integrations API
 *
 * GET  — returns config status per provider (has DB config? has env vars?)
 * PUT  — saves encrypted OAuth credentials for a provider (ADMIN only)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireSession, requireRole } from "@/server/auth";
import { encrypt, decrypt, maskToken } from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";

// ─── Provider definitions ───────────────────────────────────────────────────

interface ProviderDef {
  key: string;
  name: string;
  envVarNames: { clientId: string; clientSecret: string; extra?: Record<string, string> };
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
  oauthCallbackPath: string;
  docsUrl: string;
  setupSteps: string[];
}

const PROVIDERS: ProviderDef[] = [
  {
    key: "gmail",
    name: "Gmail",
    envVarNames: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-...", secret: true },
    ],
    oauthCallbackPath: "/api/integrations/callback/gmail",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    setupSteps: [
      "Go to Google Cloud Console > APIs & Services > Credentials",
      "Click 'Create Credentials' > 'OAuth client ID'",
      "Select 'Web application' as the application type",
      "Add the Redirect URI shown below under 'Authorized redirect URIs'",
      "Enable the Gmail API in APIs & Services > Library",
      "Copy the Client ID and Client Secret here",
    ],
  },
  {
    key: "google-calendar",
    name: "Google Calendar",
    envVarNames: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-...", secret: true },
    ],
    oauthCallbackPath: "/api/integrations/callback/google-calendar",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    setupSteps: [
      "Go to Google Cloud Console > APIs & Services > Credentials",
      "Use the same OAuth credentials as Gmail, or create a new set",
      "Enable the Google Calendar API in APIs & Services > Library",
      "Add the Redirect URI shown below under 'Authorized redirect URIs'",
      "Copy the Client ID and Client Secret here",
    ],
  },
  {
    key: "outlook",
    name: "Outlook",
    envVarNames: { clientId: "MICROSOFT_CLIENT_ID", clientSecret: "MICROSOFT_CLIENT_SECRET" },
    fields: [
      { key: "clientId", label: "Application (Client) ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret Value", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
    oauthCallbackPath: "/api/integrations/callback/outlook",
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    setupSteps: [
      "Go to Azure Portal > App Registrations > New Registration",
      "Set the Redirect URI (Web) to the value shown below",
      "Under 'Certificates & Secrets', create a new Client Secret",
      "Under 'API Permissions', add Microsoft Graph: Mail.Read, Mail.Send, Calendars.Read",
      "Grant admin consent for your organization",
      "Copy the Application (Client) ID and Client Secret Value here",
    ],
  },
  {
    key: "slack",
    name: "Slack",
    envVarNames: { clientId: "SLACK_CLIENT_ID", clientSecret: "SLACK_CLIENT_SECRET" },
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxx.xxxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
    oauthCallbackPath: "/api/integrations/callback/slack",
    docsUrl: "https://api.slack.com/apps",
    setupSteps: [
      "Go to api.slack.com/apps and click 'Create New App'",
      "Choose 'From scratch' and select your workspace",
      "Under 'OAuth & Permissions', add the Redirect URL shown below",
      "Add required Bot Token Scopes: chat:write, channels:read, users:read",
      "Copy the Client ID and Client Secret from 'Basic Information'",
    ],
  },
  {
    key: "twilio",
    name: "Twilio",
    envVarNames: {
      clientId: "TWILIO_ACCOUNT_SID",
      clientSecret: "TWILIO_AUTH_TOKEN",
      extra: { phoneNumber: "TWILIO_PHONE_NUMBER" },
    },
    fields: [
      { key: "clientId", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "clientSecret", label: "Auth Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "phoneNumber", label: "Phone Number", placeholder: "+1234567890" },
    ],
    oauthCallbackPath: "",
    docsUrl: "https://console.twilio.com",
    setupSteps: [
      "Go to console.twilio.com and sign in",
      "Find your Account SID and Auth Token on the dashboard",
      "Go to Phone Numbers > Manage > Active Numbers",
      "Copy your Twilio phone number (with country code)",
      "Paste all three values here",
    ],
  },
];

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [user, errRes] = await requireSession();
    if (errRes) return errRes;

    const roleErr = requireRole(user, "ADMIN");
    if (roleErr) return roleErr;

    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const results = await Promise.all(
      PROVIDERS.map(async (p) => {
        // Check for DB-stored config
        const configId = `config_${user.organizationId}_${p.key}`;
        let hasDbConfig = false;
        let maskedClientId: string | null = null;

        try {
          const stored = await prisma.integrationCredential.findUnique({
            where: { id: configId },
            select: { accessToken: true },
          });
          if (stored?.accessToken) {
            const decrypted = decrypt(stored.accessToken);
            const config = JSON.parse(decrypted);
            if (config.clientId && config.clientSecret) {
              hasDbConfig = true;
              maskedClientId = maskToken(config.clientId);
            }
          }
        } catch {}

        // Check env vars
        const hasEnvVars = !!(
          process.env[p.envVarNames.clientId] &&
          process.env[p.envVarNames.clientSecret]
        );

        return {
          key: p.key,
          name: p.name,
          fields: p.fields,
          redirectUri: p.oauthCallbackPath ? `${baseUrl}${p.oauthCallbackPath}` : null,
          docsUrl: p.docsUrl,
          setupSteps: p.setupSteps,
          hasDbConfig,
          hasEnvVars,
          isConfigured: hasDbConfig || hasEnvVars,
          maskedClientId,
        };
      })
    );

    return sendSuccess(results);
  } catch (error: any) {
    console.error("GET /api/settings/integrations error:", error);
    return sendUnhandledError();
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const [user, errRes] = await requireSession();
    if (errRes) return errRes;

    const roleErr = requireRole(user, "ADMIN");
    if (roleErr) return roleErr;

    const body = await request.json();
    const { provider, credentials } = body as {
      provider: string;
      credentials: Record<string, string>;
    };

    if (!provider || !credentials) {
      return sendError(badRequest("provider and credentials are required"));
    }

    const providerDef = PROVIDERS.find((p) => p.key === provider);
    if (!providerDef) {
      return sendError(badRequest(`Unknown provider: ${provider}`));
    }

    // Validate required fields
    if (!credentials.clientId || !credentials.clientSecret) {
      return sendError(badRequest("clientId and clientSecret are required"));
    }

    // Build the config object from the provider's field definitions
    const configObj: Record<string, string> = {};
    for (const field of providerDef.fields) {
      const val = credentials[field.key];
      if (val) {
        configObj[field.key] = val;
      }
    }

    // Encrypt the entire config as a JSON blob
    const encrypted = encrypt(JSON.stringify(configObj));

    // Upsert with a synthetic deterministic ID
    const configId = `config_${user.organizationId}_${provider}`;

    // We need a valid integrationId for the FK. Find or create the integration record.
    let integration = await prisma.integration.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [{ providerKey: provider }, { slug: provider }],
      },
    });

    if (!integration) {
      integration = await prisma.integration.create({
        data: {
          organizationId: user.organizationId,
          name: providerDef.name,
          slug: `${provider}-${user.organizationId.slice(0, 8)}`,
          providerKey: provider,
          status: "DISCONNECTED",
          authType: provider === "twilio" ? "api_key" : "oauth2",
          domain: getDomain(provider),
        },
      });
    }

    await prisma.integrationCredential.upsert({
      where: { id: configId },
      create: {
        id: configId,
        integrationId: integration.id,
        accessToken: encrypted,
      },
      update: {
        accessToken: encrypted,
        updatedAt: new Date(),
      },
    });

    // Audit log
    writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "UPDATE",
      objectType: "IntegrationConfig",
      objectId: configId,
      details: { provider, fieldsUpdated: Object.keys(configObj) },
      source: "settings",
    });

    return sendSuccess({
      provider,
      saved: true,
      maskedClientId: maskToken(configObj.clientId),
    });
  } catch (error: any) {
    console.error("PUT /api/settings/integrations error:", error);
    return sendUnhandledError();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDomain(provider: string): string {
  const map: Record<string, string> = {
    gmail: "email",
    "google-calendar": "calendar",
    outlook: "email",
    slack: "messaging",
    twilio: "telephony",
  };
  return map[provider] ?? "generic";
}
