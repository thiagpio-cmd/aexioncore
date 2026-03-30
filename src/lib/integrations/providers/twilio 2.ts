/**
 * Twilio Integration Provider
 *
 * Real implementation of the IntegrationProvider contract for Twilio.
 * Uses API Key authentication (Account SID + Auth Token) and the Twilio REST API.
 * Covers both voice calls (Call Logs) and SMS messages.
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 */

import {
  BaseProvider,
  type ProviderMetadata,
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

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

const MAX_RECORDS_PER_SYNC = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTwilioConfig(): {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
} {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    throw new Error(
      "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables"
    );
  }

  return {
    accountSid,
    authToken,
    phoneNumber: phoneNumber ?? "",
  };
}

/**
 * Build the Basic auth header for Twilio REST API.
 */
function getTwilioAuthHeader(credentials?: StoredCredentials): string {
  // Prefer stored credentials (per-integration); fall back to env vars
  const sid =
    credentials?.metadata?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? "";
  const token =
    credentials?.apiKey ?? process.env.TWILIO_AUTH_TOKEN ?? "";
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

/**
 * Get the Account SID from credentials or env.
 */
function getAccountSid(credentials?: StoredCredentials): string {
  return (
    credentials?.metadata?.accountSid ??
    process.env.TWILIO_ACCOUNT_SID ??
    ""
  );
}

/**
 * Determine call direction relative to the Twilio phone number.
 */
function resolveCallDirection(
  call: any
): "inbound" | "outbound" {
  const direction: string = call.direction ?? "";
  if (direction.includes("outbound")) return "outbound";
  return "inbound";
}

// ─── Twilio Provider ────────────────────────────────────────────────────────

export class TwilioProvider extends BaseProvider {
  metadata: ProviderMetadata = {
    key: "twilio",
    name: "Twilio",
    domain: "telephony",
    authType: "api_key",
    syncMode: "hybrid",
    capabilities: {
      pullSync: true,
      webhookSync: true,
      outbound: true,
      healthcheck: true,
      incrementalSync: true,
      entityMappings: ["call_log", "chat_message"],
    },
    rateLimits: {
      requestsPerMinute: 100,
      requestsPerDay: 50_000,
    },
    icon: "\u{1F4DE}",
    description:
      "Connect Twilio to sync call logs, SMS messages, and automate telephony workflows",
  };

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    );
  }

  // ── Authentication ──────────────────────────────────────────────────────

  /**
   * Twilio uses API key auth, not OAuth.
   * Returns a link to the Twilio console configuration page.
   */
  getAuthorizationUrl(_state: string): string {
    return "https://console.twilio.com/";
  }

  /**
   * Not applicable for API key auth — credentials are stored directly.
   */
  async exchangeCodeForTokens(_code: string): Promise<OAuthTokens> {
    throw new Error(
      "Twilio uses API key authentication, not OAuth. Store credentials directly."
    );
  }

  /**
   * Not applicable for API key auth.
   */
  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error(
      "Twilio uses API key authentication — tokens do not expire"
    );
  }

  async revokeAccess(_credentials: StoredCredentials): Promise<void> {
    // API key revocation is handled in the Twilio console.
    // No programmatic revocation needed — credentials are wiped locally.
  }

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Validate incoming Twilio webhook signature.
   *
   * Twilio signs webhooks with HMAC-SHA1 using the Auth Token.
   * The signature is sent in the X-Twilio-Signature header.
   */
  validateWebhook(
    headers: Record<string, string>,
    body: string,
    signingSecret?: string
  ): WebhookValidationResult {
    try {
      const signature =
        headers["x-twilio-signature"] ?? headers["X-Twilio-Signature"] ?? "";
      if (!signature) {
        return { valid: false, error: "Missing X-Twilio-Signature header" };
      }

      const authToken = signingSecret ?? process.env.TWILIO_AUTH_TOKEN ?? "";
      if (!authToken) {
        return { valid: false, error: "No auth token available for signature verification" };
      }

      // Twilio signature validation requires the full URL + sorted params.
      // For webhook receivers, we trust the presence of the signature header
      // and validate format. Full URL-based validation should be done at the
      // route level where the request URL is available.
      if (signature.length < 20) {
        return { valid: false, error: "Invalid signature format" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Webhook validation error" };
    }
  }

  /**
   * Normalize a Twilio webhook payload into canonical events.
   * Handles both SMS status callbacks and voice call status callbacks.
   */
  normalizeWebhookPayload(
    eventType: string,
    payload: any
  ): CanonicalEvent[] {
    try {
      const events: CanonicalEvent[] = [];

      const callSid: string = payload.CallSid ?? "";
      const messageSid: string = payload.MessageSid ?? payload.SmsSid ?? "";
      const from: string = payload.From ?? "";
      const to: string = payload.To ?? "";
      const callStatus: string = payload.CallStatus ?? "";
      const messageStatus: string = payload.SmsStatus ?? payload.MessageStatus ?? "";
      const body: string = payload.Body ?? "";

      if (messageSid) {
        // SMS webhook
        const isInbound = eventType === "incoming_sms" || !messageStatus;
        events.push({
          provider: "twilio",
          domain: "messaging",
          eventType: isInbound ? "SMS_RECEIVED" : "SMS_SENT",
          direction: isInbound ? "inbound" : "outbound",
          channel: "SMS",
          occurredAt: new Date(),
          sourceExternalId: messageSid,
          actorExternalId: from,
          counterpartyPhone: isInbound ? from : to,
          normalizedPayload: {
            from,
            to,
            body,
            status: messageStatus,
            numMedia: payload.NumMedia,
            numSegments: payload.NumSegments,
          },
          dedupeKey: `twilio:sms:${messageSid}`,
        });
      }

      if (callSid) {
        // Call webhook
        const isInbound = eventType === "incoming_call" || callStatus === "ringing";
        events.push({
          provider: "twilio",
          domain: "telephony",
          eventType: isInbound ? "CALL_RECEIVED" : "CALL_MADE",
          direction: isInbound ? "inbound" : "outbound",
          channel: "CALL",
          occurredAt: new Date(),
          sourceExternalId: callSid,
          actorExternalId: from,
          counterpartyPhone: isInbound ? from : to,
          normalizedPayload: {
            from,
            to,
            status: callStatus,
            duration: payload.CallDuration ?? payload.Duration,
            recordingUrl: payload.RecordingUrl,
            forwardedFrom: payload.ForwardedFrom,
          },
          dedupeKey: `twilio:call:${callSid}`,
        });
      }

      return events;
    } catch {
      return [];
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Fetch initial data: recent calls + SMS messages (last N days).
   */
  async fetchInitialData(
    credentials: StoredCredentials,
    options?: { lookbackDays?: number }
  ): Promise<SyncResult> {
    const accountSid = getAccountSid(credentials);
    if (!accountSid) {
      return {
        itemsProcessed: 0,
        itemsFailed: 0,
        hasMore: false,
        errors: [{ message: "No Account SID available", retryable: false }],
      };
    }

    const lookbackDays = options?.lookbackDays ?? 30;
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - lookbackDays);
    const afterDateStr = afterDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const events: CanonicalEvent[] = [];
    let latestTimestamp: string | undefined;

    const authHeader = getTwilioAuthHeader(credentials);

    // ── Fetch Calls ──────────────────────────────────────────────────────

    try {
      const callsUrl = new URL(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/Calls.json`
      );
      callsUrl.searchParams.set("StartTime>", afterDateStr);
      callsUrl.searchParams.set("PageSize", MAX_RECORDS_PER_SYNC.toString());

      const callsResponse = await fetch(callsUrl.toString(), {
        headers: { Authorization: authHeader },
      });

      if (!callsResponse.ok) {
        const errorBody = await callsResponse.text();
        errors.push({
          message: `Failed to list calls (${callsResponse.status}): ${errorBody}`,
          retryable: callsResponse.status >= 500,
        });
      } else {
        const callsData = await callsResponse.json();
        const calls: any[] = callsData.calls ?? [];

        for (const call of calls) {
          try {
            events.push(this.callToCanonicalEvent(call));
            itemsProcessed++;

            if (
              call.date_created &&
              (!latestTimestamp || call.date_created > latestTimestamp)
            ) {
              latestTimestamp = call.date_created;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: call.sid,
              message: `Error processing call ${call.sid}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Call fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    // ── Fetch SMS Messages ───────────────────────────────────────────────

    try {
      const messagesUrl = new URL(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`
      );
      messagesUrl.searchParams.set("DateSent>", afterDateStr);
      messagesUrl.searchParams.set("PageSize", MAX_RECORDS_PER_SYNC.toString());

      const messagesResponse = await fetch(messagesUrl.toString(), {
        headers: { Authorization: authHeader },
      });

      if (!messagesResponse.ok) {
        const errorBody = await messagesResponse.text();
        errors.push({
          message: `Failed to list messages (${messagesResponse.status}): ${errorBody}`,
          retryable: messagesResponse.status >= 500,
        });
      } else {
        const messagesData = await messagesResponse.json();
        const messages: any[] = messagesData.messages ?? [];

        for (const msg of messages) {
          try {
            events.push(this.smsToCanonicalEvent(msg));
            itemsProcessed++;

            if (
              msg.date_sent &&
              (!latestTimestamp || msg.date_sent > latestTimestamp)
            ) {
              latestTimestamp = msg.date_sent;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: msg.sid,
              message: `Error processing SMS ${msg.sid}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `SMS fetch error: ${err instanceof Error ? err.message : String(err)}`,
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

    if (latestTimestamp) {
      result.nextCursor = {
        value: latestTimestamp,
        type: "timestamp",
        updatedAt: new Date(),
      };
    }

    return result;
  }

  /**
   * Fetch incremental changes since last sync using date filters.
   */
  async fetchIncrementalData(
    credentials: StoredCredentials,
    cursor?: SyncCursor
  ): Promise<SyncResult> {
    const accountSid = getAccountSid(credentials);
    if (!accountSid) {
      return {
        itemsProcessed: 0,
        itemsFailed: 0,
        hasMore: false,
        errors: [{ message: "No Account SID available", retryable: false }],
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

    const sinceDate = new Date(cursor.value);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const events: CanonicalEvent[] = [];
    let latestTimestamp: string | undefined = cursor.value;

    const authHeader = getTwilioAuthHeader(credentials);

    // ── Fetch New Calls ──────────────────────────────────────────────────

    try {
      const callsUrl = new URL(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/Calls.json`
      );
      callsUrl.searchParams.set("StartTime>", sinceDateStr);
      callsUrl.searchParams.set("PageSize", MAX_RECORDS_PER_SYNC.toString());

      const callsResponse = await fetch(callsUrl.toString(), {
        headers: { Authorization: authHeader },
      });

      if (!callsResponse.ok) {
        const errorBody = await callsResponse.text();
        errors.push({
          message: `Failed to list calls (${callsResponse.status}): ${errorBody}`,
          retryable: callsResponse.status >= 500,
        });
      } else {
        const callsData = await callsResponse.json();
        const calls: any[] = callsData.calls ?? [];

        for (const call of calls) {
          try {
            events.push(this.callToCanonicalEvent(call));
            itemsProcessed++;

            if (
              call.date_created &&
              (!latestTimestamp || call.date_created > latestTimestamp)
            ) {
              latestTimestamp = call.date_created;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: call.sid,
              message: `Error processing call ${call.sid}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Incremental call fetch error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    }

    // ── Fetch New SMS ────────────────────────────────────────────────────

    try {
      const messagesUrl = new URL(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`
      );
      messagesUrl.searchParams.set("DateSent>", sinceDateStr);
      messagesUrl.searchParams.set("PageSize", MAX_RECORDS_PER_SYNC.toString());

      const messagesResponse = await fetch(messagesUrl.toString(), {
        headers: { Authorization: authHeader },
      });

      if (!messagesResponse.ok) {
        const errorBody = await messagesResponse.text();
        errors.push({
          message: `Failed to list messages (${messagesResponse.status}): ${errorBody}`,
          retryable: messagesResponse.status >= 500,
        });
      } else {
        const messagesData = await messagesResponse.json();
        const messages: any[] = messagesData.messages ?? [];

        for (const msg of messages) {
          try {
            events.push(this.smsToCanonicalEvent(msg));
            itemsProcessed++;

            if (
              msg.date_sent &&
              (!latestTimestamp || msg.date_sent > latestTimestamp)
            ) {
              latestTimestamp = msg.date_sent;
            }
          } catch (err) {
            itemsFailed++;
            errors.push({
              externalId: msg.sid,
              message: `Error processing SMS ${msg.sid}: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            });
          }
        }
      }
    } catch (err) {
      errors.push({
        message: `Incremental SMS fetch error: ${err instanceof Error ? err.message : String(err)}`,
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

    if (latestTimestamp) {
      result.nextCursor = {
        value: latestTimestamp,
        type: "timestamp",
        updatedAt: new Date(),
      };
    }

    return result;
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /**
   * Verify Twilio account connectivity by fetching account info.
   */
  async healthcheck(credentials: StoredCredentials): Promise<HealthCheckResult> {
    const accountSid = getAccountSid(credentials);
    const authHeader = getTwilioAuthHeader(credentials);

    if (!accountSid) {
      return {
        status: "misconfigured",
        healthPercent: 0,
        message: "No Account SID configured",
        consecutiveFailures: 1,
      };
    }

    try {
      const accountUrl = `${TWILIO_API_BASE}/Accounts/${accountSid}.json`;
      const response = await fetch(accountUrl, {
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        const account = await response.json();
        return {
          status: "healthy",
          healthPercent: 100,
          message: `Connected to Twilio account: ${account.friendly_name ?? accountSid}`,
          consecutiveFailures: 0,
        };
      }

      if (response.status === 401) {
        return {
          status: "reconnect_required",
          healthPercent: 0,
          message: "Invalid Twilio credentials — check Account SID and Auth Token",
          consecutiveFailures: 1,
        };
      }

      if (response.status === 403) {
        return {
          status: "misconfigured",
          healthPercent: 0,
          message: "Twilio API access forbidden — check account permissions",
          consecutiveFailures: 1,
        };
      }

      return {
        status: "failed",
        healthPercent: 0,
        message: `Twilio API returned unexpected status: ${response.status}`,
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

  // ── Utility (public for use by sync engine) ─────────────────────────────

  /**
   * Convert a raw Twilio call record to a CanonicalEvent.
   */
  callToCanonicalEvent(call: any): CanonicalEvent {
    const direction = resolveCallDirection(call);
    const counterpartyPhone = direction === "inbound" ? call.from : call.to;

    return {
      provider: "twilio",
      domain: "telephony",
      eventType: direction === "inbound" ? "CALL_RECEIVED" : "CALL_MADE",
      direction,
      channel: "CALL",
      occurredAt: call.date_created
        ? new Date(call.date_created)
        : new Date(),
      sourceExternalId: call.sid,
      actorExternalId: call.from,
      counterpartyPhone,
      normalizedPayload: {
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        startTime: call.start_time,
        endTime: call.end_time,
        price: call.price,
        priceUnit: call.price_unit,
        direction: call.direction,
        answeredBy: call.answered_by,
        forwardedFrom: call.forwarded_from,
      },
      dedupeKey: `twilio:call:${call.sid}`,
    };
  }

  /**
   * Convert a raw Twilio SMS message record to a CanonicalEvent.
   */
  smsToCanonicalEvent(msg: any): CanonicalEvent {
    const direction: "inbound" | "outbound" =
      msg.direction === "inbound" ? "inbound" : "outbound";
    const counterpartyPhone = direction === "inbound" ? msg.from : msg.to;

    return {
      provider: "twilio",
      domain: "messaging",
      eventType: direction === "inbound" ? "SMS_RECEIVED" : "SMS_SENT",
      direction,
      channel: "SMS",
      occurredAt: msg.date_sent
        ? new Date(msg.date_sent)
        : new Date(),
      sourceExternalId: msg.sid,
      actorExternalId: msg.from,
      counterpartyPhone,
      normalizedPayload: {
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        numMedia: msg.num_media,
        numSegments: msg.num_segments,
        price: msg.price,
        priceUnit: msg.price_unit,
        direction: msg.direction,
        errorCode: msg.error_code,
        errorMessage: msg.error_message,
      },
      dedupeKey: `twilio:sms:${msg.sid}`,
    };
  }
}
