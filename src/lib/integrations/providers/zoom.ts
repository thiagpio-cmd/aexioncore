/**
 * Zoom Integration Provider
 *
 * OAuth2 integration for Zoom meeting transcriptions.
 * Scopes: meeting:read, recording:read, user:read
 *
 * Required env vars:
 *   ZOOM_CLIENT_ID
 *   ZOOM_CLIENT_SECRET
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
import { getBaseUrl } from "@/lib/utils/base-url";
import { createHmac } from "crypto";

const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_SCOPES = ["meeting:read", "recording:read", "user:read"];

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/integrations/callback/zoom`;

  if (!clientId || !clientSecret) {
    throw new Error("Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET");
  }

  return {
    clientId,
    clientSecret,
    authorizationUrl: ZOOM_AUTH_URL,
    tokenUrl: ZOOM_TOKEN_URL,
    redirectUri,
    scopes: ZOOM_SCOPES,
  };
}

export class ZoomProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "zoom",
    name: "Zoom",
    domain: "meetings",
    authType: "oauth2",
    syncMode: "push",
    description: "Receive meeting transcriptions automatically from Zoom",
    icon: "video",
  };

  isConfigured(): boolean {
    return !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
  }

  getAuthorizationUrl(state: string): string {
    const config = getOAuthConfig();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: config.scopes.join(" "),
    });
    return `${config.authorizationUrl}?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const config = getOAuthConfig();
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Zoom token exchange failed: ${err}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const config = getOAuthConfig();
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Zoom token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    const config = getOAuthConfig();
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");

    await fetch(`https://zoom.us/oauth/revoke?token=${accessToken}`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    }).catch(() => {});
  }

  validateWebhook(
    headers: Record<string, string>,
    rawBody: string,
    signingSecret: string
  ): WebhookValidationResult {
    const timestamp = headers["x-zm-request-timestamp"];
    const signature = headers["x-zm-signature"];

    if (!timestamp || !signature) {
      return { valid: false, reason: "Missing signature headers" };
    }

    const message = `v0:${timestamp}:${rawBody}`;
    const expected = `v0=${createHmac("sha256", signingSecret)
      .update(message)
      .digest("hex")}`;

    if (signature !== expected) {
      return { valid: false, reason: "Signature mismatch" };
    }

    return { valid: true };
  }

  async fetchInitialData(
    credentials: StoredCredentials,
    cursor?: SyncCursor
  ): Promise<SyncResult> {
    // Fetch recent recordings with transcripts
    const events: CanonicalEvent[] = [];
    try {
      const res = await fetch(
        `${ZOOM_API_BASE}/users/me/recordings?from=${thirtyDaysAgo()}&to=${today()}&page_size=10`,
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        }
      );

      if (!res.ok) {
        return { events, cursor: null, hasMore: false, errors: [] };
      }

      const data = await res.json();
      for (const meeting of data.meetings || []) {
        if (meeting.recording_files) {
          const transcriptFile = meeting.recording_files.find(
            (f: any) => f.file_type === "TRANSCRIPT"
          );
          if (transcriptFile?.download_url) {
            events.push({
              provider: "zoom",
              domain: "meetings",
              eventType: "MEETING_TRANSCRIPT",
              direction: "internal",
              channel: "VIDEO",
              occurredAt: new Date(meeting.start_time),
              sourceExternalId: meeting.uuid,
              normalizedPayload: JSON.stringify({
                title: meeting.topic,
                downloadUrl: transcriptFile.download_url,
                duration: meeting.duration * 60,
                participants: (meeting.participants || []).map((p: any) => ({
                  name: p.name,
                  email: p.user_email,
                })),
              }),
            });
          }
        }
      }
    } catch (e) {
      console.error("[Zoom] fetchInitialData error:", (e as Error).message);
    }

    return { events, cursor: null, hasMore: false, errors: [] };
  }

  async fetchIncrementalData(
    credentials: StoredCredentials,
    cursor: SyncCursor
  ): Promise<SyncResult> {
    return this.fetchInitialData(credentials, cursor);
  }

  async healthcheck(credentials: StoredCredentials): Promise<HealthCheckResult> {
    try {
      const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });

      if (res.ok) return { healthy: true };
      if (res.status === 401)
        return { healthy: false, status: "reconnect_required" };
      return { healthy: false, status: "degraded" };
    } catch {
      return { healthy: false, status: "failed" };
    }
  }
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export const zoomProvider = new ZoomProvider();
