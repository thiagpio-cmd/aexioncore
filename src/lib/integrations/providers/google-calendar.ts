/**
 * Google Calendar Integration Provider
 *
 * Real implementation of the IntegrationProvider contract for Google Calendar.
 * Uses Google OAuth2 and the Google Calendar API v3.
 *
 * Shares OAuth credentials with Gmail (same GOOGLE_CLIENT_ID/SECRET).
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
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
  type HealthCheckResult,
} from "../provider-contract";

// ─── Constants ───────────────────────────────────────────────────────────────

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const MAX_EVENTS_PER_SYNC = 250;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/integrations/callback/google-calendar`;

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
    scopes: CALENDAR_SCOPES,
    redirectUri,
  };
}

// ─── Google Calendar Provider ────────────────────────────────────────────────

export class GoogleCalendarProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "google-calendar",
    name: "Google Calendar",
    domain: "calendar",
    authType: "oauth2",
    syncMode: "pull",
    capabilities: {
      pullSync: true,
      webhookSync: false,
      outbound: false,
      healthcheck: true,
      incrementalSync: true,
      entityMappings: ["calendar_event"],
    },
    rateLimits: {
      requestsPerMinute: 600,
      requestsPerDay: 1_000_000,
    },
    icon: "\u{1F4C5}",
    description: "Sync calendar events and meetings",
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
        `Google Calendar token exchange failed (${response.status}): ${errorBody}`
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
        `Google Calendar token refresh failed (${response.status}): ${errorBody}`
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
        `Google Calendar revoke failed (${response.status}): ${errorBody}`
      );
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Fetch initial data: list calendar events from the last N days
   * and convert them to canonical events.
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
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - lookbackDays);

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      const listUrl = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);
      listUrl.searchParams.set("timeMin", timeMin.toISOString());
      listUrl.searchParams.set("maxResults", MAX_EVENTS_PER_SYNC.toString());
      listUrl.searchParams.set("singleEvents", "true");
      listUrl.searchParams.set("orderBy", "startTime");

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
              message: `Failed to list events (${listResponse.status}): ${errorBody}`,
              retryable: listResponse.status >= 500,
            },
          ],
        };
      }

      const listData = await listResponse.json();
      const calendarEvents: any[] = listData.items ?? [];
      const nextPageToken: string | undefined = listData.nextPageToken;
      const nextSyncToken: string | undefined = listData.nextSyncToken;

      const events: CanonicalEvent[] = [];

      for (const calEvent of calendarEvents) {
        try {
          events.push(this.calendarEventToCanonicalEvent(calEvent));
          itemsProcessed++;
        } catch (err) {
          itemsFailed++;
          errors.push({
            externalId: calEvent.id,
            message: `Error processing event ${calEvent.id}: ${err instanceof Error ? err.message : String(err)}`,
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

      // Prefer syncToken for incremental sync; fall back to pageToken
      if (nextSyncToken) {
        result.nextCursor = {
          value: nextSyncToken,
          type: "change_id",
          updatedAt: new Date(),
        };
      } else if (nextPageToken) {
        result.nextCursor = {
          value: JSON.stringify({ pageToken: nextPageToken }),
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
   * Fetch incremental changes since the last sync using Google Calendar's
   * syncToken mechanism.
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
              "No cursor provided — run initial sync first to obtain a syncToken",
            retryable: false,
          },
        ],
      };
    }

    // Parse cursor — could be a plain syncToken or JSON with pageToken
    let syncToken: string | undefined;
    let pageToken: string | undefined;
    try {
      const parsed = JSON.parse(cursor.value);
      syncToken = parsed.syncToken;
      pageToken = parsed.pageToken;
    } catch {
      syncToken = cursor.value;
    }

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      const listUrl = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);
      if (syncToken) {
        listUrl.searchParams.set("syncToken", syncToken);
      }
      if (pageToken) {
        listUrl.searchParams.set("pageToken", pageToken);
      }
      listUrl.searchParams.set("maxResults", MAX_EVENTS_PER_SYNC.toString());

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const errorBody = await listResponse.text();

        // 410 Gone means syncToken is invalid — need a full re-sync
        if (listResponse.status === 410) {
          return {
            itemsProcessed: 0,
            itemsFailed: 0,
            hasMore: false,
            errors: [
              {
                message:
                  "Sync token expired — full re-sync required",
                code: "SYNC_TOKEN_EXPIRED",
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
              message: `Incremental sync failed (${listResponse.status}): ${errorBody}`,
              retryable: listResponse.status >= 500,
            },
          ],
        };
      }

      const listData = await listResponse.json();
      const calendarEvents: any[] = listData.items ?? [];
      const nextPageToken: string | undefined = listData.nextPageToken;
      const nextSyncToken: string | undefined = listData.nextSyncToken;

      const events: CanonicalEvent[] = [];

      for (const calEvent of calendarEvents) {
        try {
          // Cancelled events in incremental sync have status "cancelled"
          if (calEvent.status === "cancelled") {
            // Still track them as processed; the sync engine can handle deletions
            events.push(this.calendarEventToCanonicalEvent(calEvent));
            itemsProcessed++;
            continue;
          }
          events.push(this.calendarEventToCanonicalEvent(calEvent));
          itemsProcessed++;
        } catch (err) {
          itemsFailed++;
          errors.push({
            externalId: calEvent.id,
            message: `Error processing event ${calEvent.id}: ${err instanceof Error ? err.message : String(err)}`,
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

      if (nextSyncToken) {
        result.nextCursor = {
          value: nextSyncToken,
          type: "change_id",
          updatedAt: new Date(),
        };
      } else if (nextPageToken) {
        result.nextCursor = {
          value: JSON.stringify({
            syncToken,
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
   * Verify token validity by calling the calendar list endpoint.
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
      const calListResponse = await fetch(
        `${CALENDAR_API_BASE}/users/me/calendarList?maxResults=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (calListResponse.ok) {
        return {
          status: "healthy",
          healthPercent: 100,
          message: "Google Calendar connected and accessible",
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 0,
        };
      }

      if (calListResponse.status === 401) {
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

      if (calListResponse.status === 403) {
        return {
          status: "misconfigured",
          healthPercent: 0,
          message:
            "Google Calendar API access forbidden — check scopes and API enablement",
          tokenExpiresAt: credentials.expiresAt,
          consecutiveFailures: 1,
        };
      }

      return {
        status: "failed",
        healthPercent: 0,
        message: `Google Calendar API returned unexpected status: ${calListResponse.status}`,
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

  // ── Utility ────────────────────────────────────────────────────────────

  /**
   * Convert a raw Google Calendar event to a CanonicalEvent.
   */
  calendarEventToCanonicalEvent(calEvent: any): CanonicalEvent {
    const startDate = calEvent.start?.dateTime ?? calEvent.start?.date;
    const endDate = calEvent.end?.dateTime ?? calEvent.end?.date;
    const organizer = calEvent.organizer?.email;
    const attendees: any[] = calEvent.attendees ?? [];

    // The first non-organizer attendee is the counterparty
    const counterparty = attendees.find(
      (a: any) => !a.organizer && !a.self
    );
    const counterpartyEmail = counterparty?.email;

    const isCancelled = calEvent.status === "cancelled";
    const eventType = isCancelled
      ? "CALENDAR_EVENT_CANCELLED"
      : "CALENDAR_EVENT_SYNCED";

    return {
      provider: "google-calendar",
      domain: "calendar",
      eventType,
      direction: "internal",
      channel: "CALENDAR",
      occurredAt: startDate ? new Date(startDate) : new Date(),
      sourceExternalId: calEvent.id ?? "",
      threadExternalId: calEvent.recurringEventId,
      actorExternalId: organizer,
      counterpartyEmail,
      normalizedPayload: {
        title: calEvent.summary,
        description: calEvent.description,
        location: calEvent.location,
        start: startDate,
        end: endDate,
        status: calEvent.status,
        htmlLink: calEvent.htmlLink,
        hangoutLink: calEvent.hangoutLink,
        conferenceData: calEvent.conferenceData,
        attendees: attendees.map((a: any) => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
          organizer: a.organizer ?? false,
          self: a.self ?? false,
        })),
        organizer: {
          email: calEvent.organizer?.email,
          displayName: calEvent.organizer?.displayName,
          self: calEvent.organizer?.self ?? false,
        },
        isAllDay: !calEvent.start?.dateTime,
        recurrence: calEvent.recurrence,
        iCalUID: calEvent.iCalUID,
      },
      dedupeKey: `gcal:event:${calEvent.id}`,
    };
  }
}
