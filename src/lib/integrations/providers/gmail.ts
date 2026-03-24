/**
 * Gmail Integration Provider
 *
 * Real implementation of the IntegrationProvider contract for Gmail.
 * Uses Google OAuth2 and the Gmail API v1.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI (default: http://localhost:3000/api/integrations/gmail/callback)
 */

import {
  BaseProvider,
  type ProviderMetadata,
  type OAuthConfig,
  type OAuthTokens,
  type StoredCredentials,
  type SyncCursor,
  type SyncResult,
  type SyncError,
  type CanonicalEvent,
  type WebhookValidationResult,
  type HealthCheckResult,
} from "../provider-contract";

// ─── Constants ───────────────────────────────────────────────────────────────

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/userinfo.email",
];

const MAX_MESSAGES_PER_SYNC = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${baseUrl}/api/integrations/callback/gmail`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables"
    );
  }

  return {
    clientId,
    clientSecret,
    authorizationUrl: GOOGLE_AUTH_URL,
    tokenUrl: GOOGLE_TOKEN_URL,
    scopes: GMAIL_SCOPES,
    redirectUri,
  };
}

/**
 * Decode a base64url-encoded string (used by Gmail API payloads).
 */
function base64urlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extract header value from Gmail message headers array.
 */
function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  return headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

/**
 * Parse an email address from a "Name <email>" string.
 */
function parseEmailAddress(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw.trim();
}

/**
 * Determine if a message was sent by the authenticated user.
 */
function isSentByUser(
  labelIds: string[] | undefined
): boolean {
  return labelIds?.includes("SENT") ?? false;
}

// ─── Gmail Provider ──────────────────────────────────────────────────────────

export class GmailProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "gmail",
    name: "Gmail",
    domain: "email",
    authType: "oauth2",
    syncMode: "hybrid",
    capabilities: {
      pullSync: true,
      webhookSync: true,
      outbound: true,
      healthcheck: true,
      incrementalSync: true,
      entityMappings: ["email_message", "contact"],
    },
    rateLimits: {
      requestsPerMinute: 250,
      requestsPerDay: 1_000_000,
    },
    icon: "\u{1F4E7}",
    description:
      "Connect Gmail to sync emails, track threads, and automate follow-ups",
  };

  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  // ── Authentication ──────────────────────────────────────────────────────

  getAuthorizationUrl(state: string): string {
    const config = getOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
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
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gmail token exchange failed (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
      tokenType: data.token_type,
      raw: data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const config = getOAuthConfig();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gmail token refresh failed (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      // Google doesn't always return a new refresh token on refresh
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
      tokenType: data.token_type,
      raw: data,
    };
  }

  async revokeAccess(credentials: StoredCredentials): Promise<void> {
    const token = credentials.accessToken ?? credentials.refreshToken;
    if (!token) return;

    const response = await fetch(
      `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (!response.ok && response.status !== 400) {
      // 400 means token already invalid — that's fine
      const errorBody = await response.text();
      throw new Error(
        `Gmail revoke failed (${response.status}): ${errorBody}`
      );
    }
  }

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Validate a Gmail push notification webhook.
   *
   * Gmail uses Google Cloud Pub/Sub for push notifications.
   * The verification is done via the Pub/Sub subscription setup,
   * not per-request HMAC. We validate that:
   * 1. The payload is valid JSON with a message.data field
   * 2. If a signing secret is configured, we verify the Bearer token
   */
  validateWebhook(
    headers: Record<string, string>,
    body: string,
    signingSecret?: string
  ): WebhookValidationResult {
    try {
      const payload = JSON.parse(body);

      // Gmail push notifications via Pub/Sub must have message.data
      if (!payload?.message?.data) {
        return {
          valid: false,
          error: "Missing message.data in Pub/Sub notification",
        };
      }

      // If a signing secret (bearer token) is configured, validate the
      // Authorization header that Google Cloud Pub/Sub sends
      if (signingSecret) {
        const authHeader =
          headers["authorization"] ?? headers["Authorization"] ?? "";
        const expectedToken = `Bearer ${signingSecret}`;
        if (authHeader !== expectedToken) {
          return {
            valid: false,
            error: "Invalid authorization token on webhook",
          };
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid JSON payload" };
    }
  }

  /**
   * Normalize a Gmail Pub/Sub push notification into canonical events.
   *
   * Gmail push notifications contain minimal data (emailAddress + historyId).
   * The actual message data must be fetched separately via the Gmail API,
   * so we produce a lightweight event indicating new activity.
   */
  normalizeWebhookPayload(
    _eventType: string,
    payload: any
  ): CanonicalEvent[] {
    try {
      const messageData = payload?.message?.data;
      if (!messageData) return [];

      const decoded = JSON.parse(base64urlDecode(messageData));
      const emailAddress: string = decoded.emailAddress ?? "";
      const historyId: string = decoded.historyId?.toString() ?? "";

      if (!emailAddress || !historyId) return [];

      // Gmail push notifications don't contain full message data,
      // so we produce a generic EMAIL_RECEIVED event as a trigger
      // for the sync engine to fetch actual changes via history API.
      const event: CanonicalEvent = {
        provider: "gmail",
        domain: "email",
        eventType: "EMAIL_RECEIVED",
        direction: "inbound",
        channel: "EMAIL",
        occurredAt: new Date(),
        sourceExternalId: `push_${historyId}`,
        actorExternalId: emailAddress,
        counterpartyEmail: emailAddress,
        normalizedPayload: {
          historyId,
          emailAddress,
          pushNotification: true,
        },
        dedupeKey: `gmail:push:${emailAddress}:${historyId}`,
      };

      return [event];
    } catch {
      return [];
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Fetch initial data: list recent messages (last N days) and convert
   * them to canonical events.
   */
  async fetchInitialData(
    credentials: StoredCredentials,
    options?: { lookbackDays?: number }
  ): Promise<SyncResult> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      return {
        itemsProcessed: 0,
        itemsFailed: 0,
        hasMore: false,
        errors: [{ message: "No access token available", retryable: false }],
      };
    }

    const lookbackDays = options?.lookbackDays ?? 30;
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - lookbackDays);
    const afterEpoch = Math.floor(afterDate.getTime() / 1000);

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;
    let nextPageToken: string | undefined;
    let latestHistoryId: string | undefined;

    try {
      // List messages from the last N days
      const query = `after:${afterEpoch}`;
      const listUrl = new URL(`${GMAIL_API_BASE}/users/me/messages`);
      listUrl.searchParams.set("q", query);
      listUrl.searchParams.set("maxResults", MAX_MESSAGES_PER_SYNC.toString());

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const errorBody = await listResponse.text();
        return {
          itemsProcessed: 0,
          itemsFailed: 0,
          hasMore: false,
          errors: [
            {
              message: `Failed to list messages (${listResponse.status}): ${errorBody}`,
              retryable: listResponse.status >= 500,
            },
          ],
        };
      }

      const listData = await listResponse.json();
      const messageList: Array<{ id: string; threadId: string }> =
        listData.messages ?? [];
      nextPageToken = listData.nextPageToken;

      const events: CanonicalEvent[] = [];

      // Fetch each message's metadata
      for (const info of messageList) {
        try {
          const msgUrl = `${GMAIL_API_BASE}/users/me/messages/${info.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
          const msgResponse = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!msgResponse.ok) {
            itemsFailed++;
            errors.push({
              externalId: info.id,
              message: `Failed to fetch message ${info.id} (${msgResponse.status})`,
              retryable: msgResponse.status >= 500,
            });
            continue;
          }

          const msg = await msgResponse.json();

          // Track the latest historyId for incremental sync cursor
          if (
            msg.historyId &&
            (!latestHistoryId ||
              Number(msg.historyId) > Number(latestHistoryId))
          ) {
            latestHistoryId = msg.historyId;
          }

          events.push(this.messageToCanonicalEvent(msg));
          itemsProcessed++;
        } catch (err) {
          itemsFailed++;
          errors.push({
            externalId: info.id,
            message: `Error processing message ${info.id}: ${err instanceof Error ? err.message : String(err)}`,
            retryable: true,
          });
        }
      }

      // Also fetch the user's profile to get the latest historyId
      // in case message list was empty
      if (!latestHistoryId) {
        try {
          const profileResponse = await fetch(
            `${GMAIL_API_BASE}/users/me/profile`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            latestHistoryId = profile.historyId;
          }
        } catch {
          // Non-critical — we can still work without it
        }
      }

      const result: SyncResult = {
        itemsProcessed,
        itemsFailed,
        hasMore: !!nextPageToken,
        errors,
        events,
      };

      // Set up cursor for subsequent incremental syncs
      if (latestHistoryId) {
        result.nextCursor = {
          value: latestHistoryId,
          type: "change_id",
          updatedAt: new Date(),
        };
      }

      if (nextPageToken) {
        // If there's a next page, also return a page token cursor
        // The sync engine should call fetchInitialData again with this
        result.nextCursor = {
          value: JSON.stringify({
            historyId: latestHistoryId,
            pageToken: nextPageToken,
          }),
          type: "page_token",
          updatedAt: new Date(),
        };
      }

      return result;
    } catch (err) {
      return {
        itemsProcessed,
        itemsFailed,
        hasMore: false,
        errors: [
          {
            message: `Initial sync error: ${err instanceof Error ? err.message : String(err)}`,
            retryable: true,
          },
          ...errors,
        ],
      };
    }
  }

  /**
   * Fetch incremental changes since the last sync using Gmail's history API.
   * Uses the historyId cursor from the previous sync.
   */
  async fetchIncrementalData(
    credentials: StoredCredentials,
    cursor?: SyncCursor
  ): Promise<SyncResult> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      return {
        itemsProcessed: 0,
        itemsFailed: 0,
        hasMore: false,
        errors: [{ message: "No access token available", retryable: false }],
      };
    }

    if (!cursor?.value) {
      return {
        itemsProcessed: 0,
        itemsFailed: 0,
        hasMore: false,
        errors: [
          {
            message:
              "No cursor provided — run initial sync first to obtain a historyId",
            retryable: false,
          },
        ],
      };
    }

    // Parse cursor — could be a plain historyId or a JSON with pageToken
    let startHistoryId: string;
    try {
      const parsed = JSON.parse(cursor.value);
      startHistoryId = parsed.historyId ?? cursor.value;
    } catch {
      startHistoryId = cursor.value;
    }

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      const historyUrl = new URL(`${GMAIL_API_BASE}/users/me/history`);
      historyUrl.searchParams.set("startHistoryId", startHistoryId);
      historyUrl.searchParams.set(
        "maxResults",
        MAX_MESSAGES_PER_SYNC.toString()
      );
      historyUrl.searchParams.set("historyTypes", "messageAdded");

      const historyResponse = await fetch(historyUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!historyResponse.ok) {
        const errorBody = await historyResponse.text();

        // 404 means the historyId is too old — need a full re-sync
        if (historyResponse.status === 404) {
          return {
            itemsProcessed: 0,
            itemsFailed: 0,
            hasMore: false,
            errors: [
              {
                message:
                  "History ID expired — full re-sync required",
                code: "HISTORY_EXPIRED",
                retryable: false,
              },
            ],
          };
        }

        return {
          itemsProcessed: 0,
          itemsFailed: 0,
          hasMore: false,
          errors: [
            {
              message: `History list failed (${historyResponse.status}): ${errorBody}`,
              retryable: historyResponse.status >= 500,
            },
          ],
        };
      }

      const historyData = await historyResponse.json();
      const historyRecords: any[] = historyData.history ?? [];
      const newHistoryId: string | undefined = historyData.historyId;
      const nextPageToken: string | undefined = historyData.nextPageToken;

      // Collect unique message IDs from history
      const messageIds = new Set<string>();
      for (const record of historyRecords) {
        const addedMessages: any[] = record.messagesAdded ?? [];
        for (const added of addedMessages) {
          if (added.message?.id) {
            messageIds.add(added.message.id);
          }
        }
      }

      // Fetch metadata for each new message
      const events: CanonicalEvent[] = [];

      for (const msgId of messageIds) {
        try {
          const msgUrl = `${GMAIL_API_BASE}/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
          const msgResponse = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!msgResponse.ok) {
            itemsFailed++;
            errors.push({
              externalId: msgId,
              message: `Failed to fetch message ${msgId} (${msgResponse.status})`,
              retryable: msgResponse.status >= 500,
            });
            continue;
          }

          const msg = await msgResponse.json();
          events.push(this.messageToCanonicalEvent(msg));
          itemsProcessed++;
        } catch (err) {
          itemsFailed++;
          errors.push({
            externalId: msgId,
            message: `Error processing message ${msgId}: ${err instanceof Error ? err.message : String(err)}`,
            retryable: true,
          });
        }
      }

      const result: SyncResult = {
        itemsProcessed,
        itemsFailed,
        hasMore: !!nextPageToken,
        errors,
        events,
      };

      // Update cursor with the latest historyId
      if (newHistoryId) {
        result.nextCursor = {
          value: nextPageToken
            ? JSON.stringify({ historyId: newHistoryId, pageToken: nextPageToken })
            : newHistoryId,
          type: nextPageToken ? "page_token" : "change_id",
          updatedAt: new Date(),
        };
      }

      return result;
    } catch (err) {
      return {
        itemsProcessed,
        itemsFailed,
        hasMore: false,
        errors: [
          {
            message: `Incremental sync error: ${err instanceof Error ? err.message : String(err)}`,
            retryable: true,
          },
          ...errors,
        ],
      };
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /**
   * Verify token validity by calling the Gmail profile endpoint.
   */
  async healthcheck(credentials: StoredCredentials): Promise<HealthCheckResult> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      return {
        status: "reconnect_required",
        healthPercent: 0,
        message: "No access token available — reconnection required",
        tokenExpiresAt: credentials.expiresAt,
        consecutiveFailures: 1,
      };
    }

    try {
      const profileResponse = await fetch(
        `${GMAIL_API_BASE}/users/me/profile`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        return {
          status: "healthy",
          healthPercent: 100,
          message: `Connected as ${profile.emailAddress ?? "unknown"}`,
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 0,
        };
      }

      if (profileResponse.status === 401) {
        // Token expired — check if we have a refresh token
        if (credentials.refreshToken) {
          return {
            status: "degraded",
            healthPercent: 30,
            message: "Access token expired — refresh required",
            tokenExpiresAt: credentials.expiresAt,
            consecutiveFailures: 1,
          };
        }
        return {
          status: "reconnect_required",
          healthPercent: 0,
          message:
            "Access token expired and no refresh token available — reconnection required",
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 1,
        };
      }

      if (profileResponse.status === 403) {
        return {
          status: "misconfigured",
          healthPercent: 0,
          message: "Gmail API access forbidden — check scopes and API enablement",
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 1,
        };
      }

      return {
        status: "failed",
        healthPercent: 0,
        message: `Gmail API returned unexpected status: ${profileResponse.status}`,
        tokenExpiresAt: credentials.expiresAt,
        consecutiveFailures: 1,
      };
    } catch (err) {
      return {
        status: "failed",
        healthPercent: 0,
        message: `Health check error: ${err instanceof Error ? err.message : String(err)}`,
        tokenExpiresAt: credentials.expiresAt,
        consecutiveFailures: 1,
      };
    }
  }

  // ── Utility (public for use by sync engine) ─────────────────────────────

  /**
   * Convert a raw Gmail message (metadata format) to a CanonicalEvent.
   * Useful for the sync engine when processing fetched messages.
   */
  messageToCanonicalEvent(
    message: any,
    _userEmail?: string
  ): CanonicalEvent {
    const headers: Array<{ name: string; value: string }> =
      message.payload?.headers ?? [];
    const from = getHeader(headers, "From");
    const to = getHeader(headers, "To");
    const subject = getHeader(headers, "Subject");
    const dateStr = getHeader(headers, "Date");
    const labelIds: string[] = message.labelIds ?? [];

    const sent = isSentByUser(labelIds);
    const eventType = sent ? "EMAIL_SENT" : "EMAIL_RECEIVED";
    const direction = sent ? "outbound" : "inbound";

    const fromEmail = parseEmailAddress(from);
    const toEmail = parseEmailAddress(to);
    const counterpartyEmail = sent ? toEmail : fromEmail;

    return {
      provider: "gmail",
      domain: "email",
      eventType,
      direction,
      channel: "EMAIL",
      occurredAt: dateStr ? new Date(dateStr) : new Date(Number(message.internalDate)),
      sourceExternalId: message.id,
      threadExternalId: message.threadId,
      actorExternalId: fromEmail,
      counterpartyEmail,
      normalizedPayload: {
        subject,
        from,
        to,
        snippet: message.snippet,
        labelIds,
        sizeEstimate: message.sizeEstimate,
      },
      dedupeKey: `gmail:msg:${message.id}`,
    };
  }
}
