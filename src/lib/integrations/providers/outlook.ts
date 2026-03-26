/**
 * Outlook / Microsoft 365 Integration Provider
 *
 * Real implementation of the IntegrationProvider contract for Outlook.
 * Uses Microsoft OAuth2 and the Microsoft Graph API v1.0.
 * Covers both Email (Mail) and Calendar in a single provider.
 *
 * Required environment variables:
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
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

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const MS_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_LOGOUT_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/logout";

const OUTLOOK_SCOPES = [
  "Mail.Read",
  "Mail.Send",
  "Calendars.Read",
  "User.Read",
  "offline_access",
];

const MAX_MESSAGES_PER_SYNC = 100;
const MAX_EVENTS_PER_SYNC = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/integrations/callback/outlook`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET environment variables"
    );
  }

  return {
    clientId,
    clientSecret,
    authorizationUrl: MS_AUTH_URL,
    tokenUrl: MS_TOKEN_URL,
    scopes: OUTLOOK_SCOPES,
    redirectUri,
  };
}

/**
 * Strip HTML tags from Outlook message body content.
 */
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

// ─── Outlook Provider ────────────────────────────────────────────────────────

export class OutlookProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "outlook",
    name: "Outlook / Microsoft 365",
    domain: "email",
    authType: "oauth2",
    syncMode: "hybrid",
    capabilities: {
      pullSync: true,
      webhookSync: true,
      outbound: true,
      healthcheck: true,
      incrementalSync: true,
      entityMappings: ["email_message", "calendar_event", "contact"],
    },
    rateLimits: {
      requestsPerMinute: 120,
      requestsPerDay: 10_000,
    },
    icon: "\u{1F4E8}",
    description:
      "Connect Outlook / Microsoft 365 to sync emails, calendar events, and automate follow-ups",
  };

  isConfigured(): boolean {
    return !!(
      process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    );
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
      response_mode: "query",
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
        `Outlook token exchange failed (${response.status}): ${errorBody}`
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
        scope: config.scopes.join(" "),
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Outlook token refresh failed (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
      tokenType: data.token_type,
      raw: data,
    };
  }

  async revokeAccess(_credentials: StoredCredentials): Promise<void> {
    // Microsoft does not offer a programmatic token revocation endpoint.
    // The recommended approach is to redirect the user to the logout URL.
    // We treat this as a no-op since credentials are wiped locally.
  }

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Validate a Microsoft Graph change notification webhook.
   *
   * Microsoft sends a validationToken query param for subscription verification,
   * and uses clientState for per-notification verification.
   */
  validateWebhook(
    _headers: Record<string, string>,
    body: string,
    signingSecret?: string
  ): WebhookValidationResult {
    try {
      const payload = JSON.parse(body);

      if (!payload?.value || !Array.isArray(payload.value)) {
        return {
          valid: false,
          error: "Missing value array in Graph notification",
        };
      }

      // Verify clientState if a signing secret is configured
      if (signingSecret) {
        for (const notification of payload.value) {
          if (notification.clientState !== signingSecret) {
            return {
              valid: false,
              error: "Invalid clientState on webhook notification",
            };
          }
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid JSON payload" };
    }
  }

  /**
   * Normalize Microsoft Graph change notifications into canonical events.
   *
   * Graph notifications contain minimal data (resource URI + changeType).
   * The actual message/event data must be fetched separately via Graph API.
   */
  normalizeWebhookPayload(
    _eventType: string,
    payload: any
  ): CanonicalEvent[] {
    try {
      const notifications: any[] = payload?.value ?? [];
      const events: CanonicalEvent[] = [];

      for (const notification of notifications) {
        const resource: string = notification.resource ?? "";
        const changeType: string = notification.changeType ?? "";
        const subscriptionId: string = notification.subscriptionId ?? "";

        if (!resource) continue;

        const isMailNotification = resource.includes("/messages");
        const isCalendarNotification = resource.includes("/events");

        if (isMailNotification) {
          events.push({
            provider: "outlook",
            domain: "email",
            eventType:
              changeType === "created" ? "EMAIL_RECEIVED" : "EMAIL_UPDATED",
            direction: "inbound",
            channel: "EMAIL",
            occurredAt: new Date(),
            sourceExternalId: `push_${subscriptionId}_${Date.now()}`,
            actorExternalId: undefined,
            normalizedPayload: {
              resource,
              changeType,
              pushNotification: true,
            },
            dedupeKey: `outlook:push:${resource}:${changeType}:${Date.now()}`,
          });
        }

        if (isCalendarNotification) {
          events.push({
            provider: "outlook",
            domain: "calendar",
            eventType: "CALENDAR_EVENT_UPDATED",
            direction: "system",
            channel: "CALENDAR",
            occurredAt: new Date(),
            sourceExternalId: `push_cal_${subscriptionId}_${Date.now()}`,
            actorExternalId: undefined,
            normalizedPayload: {
              resource,
              changeType,
              pushNotification: true,
            },
            dedupeKey: `outlook:push:cal:${resource}:${changeType}:${Date.now()}`,
          });
        }
      }

      return events;
    } catch {
      return [];
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Fetch initial data: recent emails (last N days) + upcoming calendar events.
   * Converts both to canonical events.
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
    const afterIso = afterDate.toISOString();

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const events: CanonicalEvent[] = [];
    let latestReceivedDateTime: string | undefined;

    // ── Fetch Emails ──────────────────────────────────────────────────────

    try {
      const mailUrl = new URL(`${GRAPH_API_BASE}/me/messages`);
      mailUrl.searchParams.set(
        "$filter",
        `receivedDateTime ge ${afterIso}`
      );
      mailUrl.searchParams.set("$top", MAX_MESSAGES_PER_SYNC.toString());
      mailUrl.searchParams.set("$orderby", "receivedDateTime desc");
      mailUrl.searchParams.set(
        "$select",
        "id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,sentDateTime,isDraft,isRead,conversationId"
      );

      const mailResponse = await fetch(mailUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailResponse.ok) {
        const errorBody = await mailResponse.text();
        errors.push({
          message: `Failed to list messages (${mailResponse.status}): ${errorBody}`,
          retryable: mailResponse.status >= 500,
        });
      } else {
        const mailData = await mailResponse.json();
        const messages: any[] = mailData.value ?? [];

        for (const msg of messages) {
          try {
            events.push(this.messageToCanonicalEvent(msg));
            itemsProcessed++;

            // Track latest receivedDateTime for incremental cursor
            if (
              msg.receivedDateTime &&
              (!latestReceivedDateTime ||
                msg.receivedDateTime > latestReceivedDateTime)
            ) {
              latestReceivedDateTime = msg.receivedDateTime;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: msg.id,
              message: `Error processing message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Mail fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    // ── Fetch Calendar Events ─────────────────────────────────────────────

    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

      const calUrl = new URL(`${GRAPH_API_BASE}/me/events`);
      calUrl.searchParams.set(
        "$filter",
        `start/dateTime ge '${afterIso}' and start/dateTime le '${futureDate.toISOString()}'`
      );
      calUrl.searchParams.set("$top", MAX_EVENTS_PER_SYNC.toString());
      calUrl.searchParams.set("$orderby", "start/dateTime asc");
      calUrl.searchParams.set(
        "$select",
        "id,subject,start,end,location,attendees,organizer,isAllDay,bodyPreview,webLink"
      );

      const calResponse = await fetch(calUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      });

      if (!calResponse.ok) {
        const errorBody = await calResponse.text();
        errors.push({
          message: `Failed to list calendar events (${calResponse.status}): ${errorBody}`,
          retryable: calResponse.status >= 500,
        });
      } else {
        const calData = await calResponse.json();
        const calEvents: any[] = calData.value ?? [];

        for (const event of calEvents) {
          try {
            events.push(this.calendarEventToCanonicalEvent(event));
            itemsProcessed++;
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: event.id,
              message: `Error processing calendar event ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Calendar fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    const result: SyncResult = {
      itemsProcessed,
      itemsFailed,
      hasMore: false,
      errors,
      events,
    };

    // Set up cursor for subsequent incremental syncs
    if (latestReceivedDateTime) {
      result.nextCursor = {
        value: latestReceivedDateTime,
        type: "timestamp",
        updatedAt: new Date(),
      };
    }

    return result;
  }

  /**
   * Fetch incremental changes since last sync using $filter on receivedDateTime.
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
              "No cursor provided — run initial sync first to obtain a timestamp",
            retryable: false,
          },
        ],
      };
    }

    const sinceTimestamp = cursor.value;
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const events: CanonicalEvent[] = [];
    let latestReceivedDateTime: string | undefined = sinceTimestamp;

    // ── Fetch New Emails ──────────────────────────────────────────────────

    try {
      const mailUrl = new URL(`${GRAPH_API_BASE}/me/messages`);
      mailUrl.searchParams.set(
        "$filter",
        `receivedDateTime gt ${sinceTimestamp}`
      );
      mailUrl.searchParams.set("$top", MAX_MESSAGES_PER_SYNC.toString());
      mailUrl.searchParams.set("$orderby", "receivedDateTime desc");
      mailUrl.searchParams.set(
        "$select",
        "id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,sentDateTime,isDraft,isRead,conversationId"
      );

      const mailResponse = await fetch(mailUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailResponse.ok) {
        const errorBody = await mailResponse.text();
        errors.push({
          message: `Failed to list messages (${mailResponse.status}): ${errorBody}`,
          retryable: mailResponse.status >= 500,
        });
      } else {
        const mailData = await mailResponse.json();
        const messages: any[] = mailData.value ?? [];

        for (const msg of messages) {
          try {
            events.push(this.messageToCanonicalEvent(msg));
            itemsProcessed++;

            if (
              msg.receivedDateTime &&
              (!latestReceivedDateTime ||
                msg.receivedDateTime > latestReceivedDateTime)
            ) {
              latestReceivedDateTime = msg.receivedDateTime;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: msg.id,
              message: `Error processing message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Incremental mail fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    // ── Fetch New Calendar Events ─────────────────────────────────────────

    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const calUrl = new URL(`${GRAPH_API_BASE}/me/events`);
      calUrl.searchParams.set(
        "$filter",
        `lastModifiedDateTime gt ${sinceTimestamp}`
      );
      calUrl.searchParams.set("$top", MAX_EVENTS_PER_SYNC.toString());
      calUrl.searchParams.set("$orderby", "lastModifiedDateTime desc");
      calUrl.searchParams.set(
        "$select",
        "id,subject,start,end,location,attendees,organizer,isAllDay,bodyPreview,webLink"
      );

      const calResponse = await fetch(calUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      });

      if (!calResponse.ok) {
        const errorBody = await calResponse.text();
        errors.push({
          message: `Failed to list calendar events (${calResponse.status}): ${errorBody}`,
          retryable: calResponse.status >= 500,
        });
      } else {
        const calData = await calResponse.json();
        const calEvents: any[] = calData.value ?? [];

        for (const event of calEvents) {
          try {
            events.push(this.calendarEventToCanonicalEvent(event));
            itemsProcessed++;
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: event.id,
              message: `Error processing calendar event ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Incremental calendar fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    const result: SyncResult = {
      itemsProcessed,
      itemsFailed,
      hasMore: false,
      errors,
      events,
    };

    if (latestReceivedDateTime) {
      result.nextCursor = {
        value: latestReceivedDateTime,
        type: "timestamp",
        updatedAt: new Date(),
      };
    }

    return result;
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /**
   * Verify token validity by calling the Graph /me endpoint.
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
      const meResponse = await fetch(`${GRAPH_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (meResponse.ok) {
        const profile = await meResponse.json();
        return {
          status: "healthy",
          healthPercent: 100,
          message: `Connected as ${profile.mail ?? profile.userPrincipalName ?? "unknown"}`,
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 0,
        };
      }

      if (meResponse.status === 401) {
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

      if (meResponse.status === 403) {
        return {
          status: "misconfigured",
          healthPercent: 0,
          message:
            "Microsoft Graph API access forbidden — check scopes and API permissions",
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 1,
        };
      }

      return {
        status: "failed",
        healthPercent: 0,
        message: `Microsoft Graph API returned unexpected status: ${meResponse.status}`,
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
   * Convert a raw Microsoft Graph message to a CanonicalEvent.
   */
  messageToCanonicalEvent(msg: any): CanonicalEvent {
    const fromEmail: string =
      msg.from?.emailAddress?.address ?? "unknown";
    const toEmail: string =
      msg.toRecipients?.[0]?.emailAddress?.address ?? undefined;

    const isSent =
      msg.from?.emailAddress?.address &&
      msg.sentDateTime &&
      !msg.isDraft;

    // Determine direction: if the message is in sentItems or was sent
    const eventType = isSent ? "EMAIL_SENT" : "EMAIL_RECEIVED";
    const direction = isSent ? "outbound" : "inbound";
    const counterpartyEmail = isSent ? toEmail : fromEmail;

    return {
      provider: "outlook",
      domain: "email",
      eventType,
      direction: direction as "inbound" | "outbound",
      channel: "EMAIL",
      occurredAt: msg.receivedDateTime
        ? new Date(msg.receivedDateTime)
        : new Date(),
      sourceExternalId: msg.id,
      threadExternalId: msg.conversationId,
      actorExternalId: fromEmail,
      counterpartyEmail,
      normalizedPayload: {
        subject: msg.subject,
        from: fromEmail,
        to: toEmail,
        snippet: msg.bodyPreview,
        body: msg.body?.content ? stripHtml(msg.body.content) : undefined,
        isRead: msg.isRead,
        isDraft: msg.isDraft,
        source: "outlook",
      },
      dedupeKey: `outlook:msg:${msg.id}`,
    };
  }

  /**
   * Convert a raw Microsoft Graph calendar event to a CanonicalEvent.
   */
  calendarEventToCanonicalEvent(event: any): CanonicalEvent {
    const organizerEmail: string =
      event.organizer?.emailAddress?.address ?? undefined;
    const attendees: string[] =
      event.attendees?.map(
        (a: any) => a.emailAddress?.address
      ).filter(Boolean) ?? [];

    return {
      provider: "outlook",
      domain: "calendar",
      eventType: "CALENDAR_EVENT_CREATED",
      direction: "system",
      channel: "CALENDAR",
      occurredAt: event.start?.dateTime
        ? new Date(event.start.dateTime)
        : new Date(),
      sourceExternalId: event.id,
      actorExternalId: organizerEmail,
      normalizedPayload: {
        title: event.subject,
        subject: event.subject,
        startTime: event.start?.dateTime,
        endTime: event.end?.dateTime,
        location: event.location?.displayName,
        attendees,
        organizer: organizerEmail,
        isAllDay: event.isAllDay,
        bodyPreview: event.bodyPreview,
        webLink: event.webLink,
        source: "outlook_calendar",
      },
      dedupeKey: `outlook:cal:${event.id}`,
    };
  }
}
