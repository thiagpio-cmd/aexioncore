/**
 * Provider Configuration Resolver
 *
 * Resolves OAuth / API credentials for a provider by checking:
 *   1. Organization-specific config stored in DB (self-service)
 *   2. Platform-level environment variables (legacy / shared)
 *
 * This lets admins bring their own OAuth app via the Settings UI
 * while keeping backward compatibility with .env-based setup.
 */

import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/integrations/credential-vault";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  [key: string]: string;
}

// ─── Env-var mapping per provider ───────────────────────────────────────────

const ENV_MAP: Record<
  string,
  { clientId: string; clientSecret: string; extra?: Record<string, string> }
> = {
  gmail: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  "google-calendar": {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  outlook: {
    clientId: "MICROSOFT_CLIENT_ID",
    clientSecret: "MICROSOFT_CLIENT_SECRET",
  },
  slack: {
    clientId: "SLACK_CLIENT_ID",
    clientSecret: "SLACK_CLIENT_SECRET",
  },
  twilio: {
    clientId: "TWILIO_ACCOUNT_SID",
    clientSecret: "TWILIO_AUTH_TOKEN",
    extra: { phoneNumber: "TWILIO_PHONE_NUMBER" },
  },
};

// ─── Resolver ───────────────────────────────────────────────────────────────

/**
 * Resolve provider credentials.
 *
 * Priority:
 *   1. DB-stored per-organization config (encrypted JSON in IntegrationCredential)
 *   2. Env-var fallback
 *
 * Returns null when neither source has valid credentials.
 */
export async function getProviderConfig(
  provider: string,
  organizationId: string
): Promise<ProviderConfig | null> {
  // ── 1. Check database (self-service config) ────────────────────────────
  try {
    const configId = `config_${organizationId}_${provider}`;
    const stored = await prisma.integrationCredential.findUnique({
      where: { id: configId },
    });

    if (stored?.accessToken) {
      const decrypted = decrypt(stored.accessToken);
      const config: ProviderConfig = JSON.parse(decrypted);
      if (config.clientId && config.clientSecret) {
        return config;
      }
    }
  } catch {
    // Swallow — fall through to env-var lookup
  }

  // ── 2. Fallback to environment variables ───────────────────────────────
  const mapping = ENV_MAP[provider];
  if (!mapping) return null;

  const clientId = process.env[mapping.clientId];
  const clientSecret = process.env[mapping.clientSecret];
  if (!clientId || !clientSecret) return null;

  const config: ProviderConfig = { clientId, clientSecret };

  if (mapping.extra) {
    for (const [key, envKey] of Object.entries(mapping.extra)) {
      const val = process.env[envKey];
      if (val) config[key] = val;
    }
  }

  return config;
}

/**
 * Check whether an organization has self-service config stored in DB
 * (without decrypting — just existence check for UI status).
 */
export async function hasStoredConfig(
  provider: string,
  organizationId: string
): Promise<boolean> {
  try {
    const configId = `config_${organizationId}_${provider}`;
    const stored = await prisma.integrationCredential.findUnique({
      where: { id: configId },
      select: { id: true },
    });
    return !!stored;
  } catch {
    return false;
  }
}
