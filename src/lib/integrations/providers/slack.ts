/**
 * Slack Bot Integration Provider
 *
 * Real implementation of the IntegrationProvider contract for Slack.
 * Uses Slack OAuth2 v2 for bot tokens and the Slack Web API.
 * Focused on outbound notifications (posting to channels) and health checks.
 *
 * Required environment variables:
 *   SLACK_CLIENT_ID
 *   SLACK_CLIENT_SECRET
 */

import {
  BaseProvider,
  type ProviderMetadata,
  type OAuthConfig,
  type OAuthTokens,
  type StoredCredentials,
  type SyncCursor,
  type SyncResult,
  type CanonicalEvent,
  type WebhookValidationResult,
  type HealthCheckResult,
} from "../provider-contract";

// ─── Constants ───────────────────────────────────────────────────────────────

const SLACK_API_BASE = "https://slack.com/api";
const SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_SCOPES = [
  "chat:write",
  "channels:read",
  "incoming-webhook",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/integrations/callback/slack`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET environment variables"
    );
  }

  return {
    clientId,
    clientSecret,
    authorizationUrl: SLACK_AUTH_URL,
    tokenUrl: SLACK_TOKEN_URL,
    scopes: SLACK_SCOPES,
    redirectUri,
  };
}

// ─── Slack Provider ─────────────────────────────────────────────────────────

export class SlackProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "slack",
    name: "Slack",
    domain: "messaging",
    authType: "oauth2",
    syncMode: "push",
    capabilities: {
      pullSync: false,
      webhookSync: true,
      outbound: true,
      healthcheck: true,
      incrementalSync: false,
      entityMappings: ["chat_message"],
    },
    rateLimits: {
      requestsPerMinute: 50,
      requestsPerDay: 10_000,
    },
    icon: "\u{1F4AC}",
    description:
      "Connect Slack to send notifications, alerts, and automate team communication",
  };

  isConfigured(): boolean {
    return !!(
      process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
    );
  }

  // ── Authentication ──────────────────────────────────────────────────────

  getAuthorizationUrl(state: string): string {
    const config = getOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(","),
      state,
    });
    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Slack token exchange failed (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(
        `Slack token exchange error: ${data.error ?? "unknown error"}`
      );
    }

    // Slack OAuth v2 returns bot token in access_token
    return {
      accessToken: data.access_token,
      // Slack bot tokens do not expire and have no refresh token
      refreshToken: undefined,
      expiresAt: undefined,
      scope: data.scope,
      tokenType: data.token_type ?? "bot",
      raw: data,
    };
  }

  /**
   * Slack bot tokens do not expire — refresh is not needed.
   */
  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error(
      "Slack bot tokens do not expire — refresh is not applicable"
    );
  }

  async revokeAccess(credentials: StoredCredentials): Promise<void> {
    const token = credentials.accessToken;
    if (!token) return;

    const response = await fetch(`${SLACK_API_BASE}/auth.revoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Slack revoke failed (${response.status}): ${errorBody}`
      );
    }
  }

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Validate incoming Slack event webhook.
   *
   * Slack signs webhooks with HMAC-SHA256 using the Signing Secret.
   * The signature is sent in the X-Slack-Signature header along
   * with a timestamp in X-Slack-Request-Timestamp.
   */
  validateWebhook(
    headers: Record<string, string>,
    body: string,
    signingSecret?: string
  ): WebhookValidationResult {
    try {
      const signature =
        headers["x-slack-signature"] ?? headers["X-Slack-Signature"] ?? "";
      const timestamp =
        headers["x-slack-request-timestamp"] ??
        headers["X-Slack-Request-Timestamp"] ??
        "";

      if (!signature || !timestamp) {
        return {
          valid: false,
          error: "Missing X-Slack-Signature or X-Slack-Request-Timestamp header",
        };
      }

      const secret = signingSecret ?? process.env.SLACK_SIGNING_SECRET ?? "";
      if (!secret) {
        // If no signing secret is configured, accept but warn
        return { valid: true };
      }

      // Replay protection: reject if timestamp is older than 5 minutes
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - Number(timestamp)) > 300) {
        return { valid: false, error: "Request timestamp too old (replay protection)" };
      }

      // Compute expected signature
      const { createHmac } = require("crypto");
      const sigBasestring = `v0:${timestamp}:${body}`;
      const expectedSignature =
        "v0=" + createHmac("sha256", secret).update(sigBasestring).digest("hex");

      if (signature !== expectedSignature) {
        return { valid: false, error: "Invalid webhook signature" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Webhook validation error" };
    }
  }

  /**
   * Normalize a Slack Events API payload into canonical events.
   */
  normalizeWebhookPayload(
    _eventType: string,
    payload: any
  ): CanonicalEvent[] {
    try {
      const event = payload?.event;
      if (!event) return [];

      const events: CanonicalEvent[] = [];

      if (event.type === "message" && !event.subtype) {
        events.push({
          provider: "slack",
          domain: "messaging",
          eventType: "CHAT_MESSAGE_RECEIVED",
          direction: "inbound",
          channel: "SLACK",
          occurredAt: event.ts
            ? new Date(Number(event.ts.split(".")[0]) * 1000)
            : new Date(),
          sourceExternalId: event.ts ?? `slack_${Date.now()}`,
          threadExternalId: event.thread_ts,
          actorExternalId: event.user,
          normalizedPayload: {
            text: event.text,
            channel: event.channel,
            user: event.user,
            threadTs: event.thread_ts,
            teamId: payload.team_id,
          },
          dedupeKey: `slack:msg:${event.channel}:${event.ts}`,
        });
      }

      return events;
    } catch {
      return [];
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Slack provider is push-only (webhook-based).
   * Pull sync is not supported — returns empty result.
   */
  async fetchInitialData(
    _credentials: StoredCredentials,
    _options?: { lookbackDays?: number }
  ): Promise<SyncResult> {
    return {
      itemsProcessed: 0,
      itemsFailed: 0,
      hasMore: false,
      errors: [],
      events: [],
    };
  }

  /**
   * Slack provider is push-only — incremental pull not supported.
   */
  async fetchIncrementalData(
    _credentials: StoredCredentials,
    _cursor?: SyncCursor
  ): Promise<SyncResult> {
    return {
      itemsProcessed: 0,
      itemsFailed: 0,
      hasMore: false,
      errors: [],
      events: [],
    };
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /**
   * Verify Slack bot token validity using auth.test API.
   */
  async healthcheck(credentials: StoredCredentials): Promise<HealthCheckResult> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      return {
        status: "reconnect_required",
        healthPercent: 0,
        message: "No access token available — reconnection required",
        consecutiveFailures: 1,
      };
    }

    try {
      const response = await fetch(`${SLACK_API_BASE}/auth.test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!response.ok) {
        return {
          status: "failed",
          healthPercent: 0,
          message: `Slack API returned HTTP ${response.status}`,
          consecutiveFailures: 1,
        };
      }

      const data = await response.json();

      if (data.ok) {
        return {
          status: "healthy",
          healthPercent: 100,
          message: `Connected to Slack workspace: ${data.team ?? "unknown"} as ${data.user ?? "bot"}`,
          consecutiveFailures: 0,
        };
      }

      if (data.error === "invalid_auth" || data.error === "token_revoked") {
        return {
          status: "reconnect_required",
          healthPercent: 0,
          message: `Slack authentication invalid: ${data.error}`,
          consecutiveFailures: 1,
        };
      }

      return {
        status: "failed",
        healthPercent: 0,
        message: `Slack auth.test failed: ${data.error ?? "unknown error"}`,
        consecutiveFailures: 1,
      };
    } catch (err) {
      return {
        status: "failed",
        healthPercent: 0,
        message: `Health check error: ${err instanceof Error ? err.message : String(err)}`,
        consecutiveFailures: 1,
      };
    }
  }

  // ── Outbound (public for use by notification engine) ────────────────────

  /**
   * Send a notification message to a Slack channel.
   * Requires the bot token and a channel ID.
   */
  async sendNotification(
    credentials: StoredCredentials,
    channelId: string,
    text: string,
    options?: {
      blocks?: any[];
      threadTs?: string;
      unfurlLinks?: boolean;
    }
  ): Promise<{ ok: boolean; ts?: string; error?: string }> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      return { ok: false, error: "No access token available" };
    }

    try {
      const body: Record<string, any> = {
        channel: channelId,
        text,
      };

      if (options?.blocks) body.blocks = options.blocks;
      if (options?.threadTs) body.thread_ts = options.threadTs;
      if (options?.unfurlLinks !== undefined)
        body.unfurl_links = options.unfurlLinks;

      const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          error: `Slack API HTTP error (${response.status}): ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        ok: data.ok ?? false,
        ts: data.ts,
        error: data.error,
      };
    } catch (err) {
      return {
        ok: false,
        error: `Send notification error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
