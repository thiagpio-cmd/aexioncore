/**
 * Integration Provider Contract
 *
 * Every connector MUST implement this interface.
 * This is the backbone that makes adding a new provider a "fill in the blanks"
 * exercise instead of a "rewrite the product" exercise.
 *
 * Design principles:
 * - Every method is self-contained
 * - Errors never bubble uncaught
 * - Raw data is always preserved alongside normalized data
 * - Source attribution is mandatory
 */

// ─── Provider Metadata ──────────────────────────────────────────────────────

export type IntegrationDomain =
  | "email"
  | "calendar"
  | "crm"
  | "messaging"
  | "telephony"
  | "forms"
  | "collaboration"
  | "generic";

export type AuthType =
  | "oauth2"
  | "api_key"
  | "webhook_only"
  | "basic"
  | "none";

export type SyncMode = "push" | "pull" | "hybrid";

export interface ProviderCapabilities {
  /** Can pull data on-demand or via cron */
  pullSync: boolean;
  /** Can receive webhooks */
  webhookSync: boolean;
  /** Can send data outbound (e.g., send email, send message) */
  outbound: boolean;
  /** Supports health checks */
  healthcheck: boolean;
  /** Supports incremental sync via cursor */
  incrementalSync: boolean;
  /** Which canonical entities this provider can produce */
  entityMappings: CanonicalEntityType[];
}

export type CanonicalEntityType =
  | "contact"
  | "company"
  | "lead"
  | "opportunity"
  | "account"
  | "email_message"
  | "calendar_event"
  | "chat_message"
  | "call_log"
  | "task"
  | "note";

export interface ProviderMetadata {
  /** Unique key for this provider (e.g., "gmail", "hubspot") */
  key: string;
  /** Human-readable name */
  name: string;
  /** Domain category */
  domain: IntegrationDomain;
  /** Authentication method */
  authType: AuthType;
  /** How data flows */
  syncMode: SyncMode;
  /** What this provider can do */
  capabilities: ProviderCapabilities;
  /** Known rate limits */
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  /** Icon/emoji for UI */
  icon: string;
  /** Description */
  description: string;
}

// ─── OAuth Types ────────────────────────────────────────────────────────────

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  raw?: Record<string, any>;
}

// ─── Credential Types ───────────────────────────────────────────────────────

export interface StoredCredentials {
  id: string;
  integrationId: string;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  signingSecret?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>; // mailboxId, calendarId, phoneNumberId, etc.
}

// ─── Sync Types ─────────────────────────────────────────────────────────────

export interface SyncCursor {
  /** Provider-specific cursor value (page token, timestamp, etc.) */
  value: string;
  /** Type of cursor */
  type: "page_token" | "timestamp" | "offset" | "change_id";
  /** When this cursor was last updated */
  updatedAt: Date;
}

export interface SyncResult {
  /** Items successfully synced */
  itemsProcessed: number;
  /** Items that failed */
  itemsFailed: number;
  /** New cursor for next sync */
  nextCursor?: SyncCursor;
  /** Whether there are more items to fetch */
  hasMore: boolean;
  /** Errors encountered */
  errors: SyncError[];
  /** The actual normalized events fetched during this sync */
  events?: CanonicalEvent[];
}

export interface SyncError {
  externalId?: string;
  message: string;
  code?: string;
  retryable: boolean;
}

// ─── Canonical Event Types ──────────────────────────────────────────────────

export type EventDirection = "inbound" | "outbound" | "internal" | "system";

export type EventChannel =
  | "EMAIL"
  | "WHATSAPP"
  | "SMS"
  | "CALL"
  | "CALENDAR"
  | "CRM"
  | "SLACK"
  | "TEAMS"
  | "WEBHOOK"
  | "INTERNAL"
  | "SYSTEM";

export interface CanonicalEvent {
  /** Provider key (e.g., "gmail") */
  provider: string;
  /** Domain (e.g., "email") */
  domain: IntegrationDomain;
  /** Event type from taxonomy (e.g., "EMAIL_RECEIVED") */
  eventType: string;
  /** Direction */
  direction: EventDirection;
  /** Channel */
  channel: EventChannel;
  /** When the event actually happened */
  occurredAt: Date;
  /** External ID from the provider */
  sourceExternalId: string;
  /** Thread/conversation ID from provider */
  threadExternalId?: string;
  /** Actor external ID (who did it in the external system) */
  actorExternalId?: string;
  /** Counterparty external ID (the other party) */
  counterpartyExternalId?: string;
  /** Counterparty email (for resolution) */
  counterpartyEmail?: string;
  /** Counterparty phone (for resolution) */
  counterpartyPhone?: string;
  /** Normalized payload (domain-specific structured data) */
  normalizedPayload: Record<string, any>;
  /** Raw payload reference (stored separately) */
  rawPayload?: string;
  /** Deduplication key */
  dedupeKey: string;
  /** Confidence of entity resolution (0-100) */
  resolutionConfidence?: number;
}

// ─── Webhook Types ──────────────────────────────────────────────────────────

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Health Types ───────────────────────────────────────────────────────────

export type HealthStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "failed"
  | "reconnect_required"
  | "misconfigured";

export interface HealthCheckResult {
  status: HealthStatus;
  /** 0-100 */
  healthPercent: number;
  /** Human-readable message */
  message: string;
  /** When last successful sync occurred */
  lastSuccessfulSync?: Date;
  /** When token expires */
  tokenExpiresAt?: Date;
  /** Number of consecutive failures */
  consecutiveFailures: number;
}

// ─── Provider Interface ─────────────────────────────────────────────────────

/**
 * THE CONTRACT.
 * Every integration provider must implement this interface.
 */
export interface IntegrationProvider {
  /** Provider metadata and capabilities */
  metadata: ProviderMetadata;

  /** Check if environment variables are present on the platform */
  isConfigured(): boolean;

  // ── Authentication ──────────────────────────────────────────────────────

  /**
   * Generate OAuth authorization URL.
   * Returns the URL to redirect the user to for authorization.
   */
  getAuthorizationUrl(state: string): string;

  /**
   * Exchange authorization code for tokens.
   * Called after OAuth callback.
   */
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;

  /**
   * Refresh an expired access token.
   * Returns new tokens or throws if refresh fails (requires re-auth).
   */
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Revoke access (disconnect cleanly).
   */
  revokeAccess(credentials: StoredCredentials): Promise<void>;

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Validate incoming webhook signature.
   * Returns validation result.
   */
  validateWebhook(
    headers: Record<string, string>,
    body: string,
    signingSecret?: string
  ): WebhookValidationResult;

  /**
   * Normalize a webhook payload into canonical events.
   * A single webhook may produce multiple canonical events.
   */
  normalizeWebhookPayload(
    eventType: string,
    payload: any
  ): CanonicalEvent[];

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Perform initial data sync (first connection).
   * Should fetch recent data (e.g., last 30 days).
   */
  fetchInitialData(
    credentials: StoredCredentials,
    options?: { lookbackDays?: number }
  ): Promise<SyncResult>;

  /**
   * Fetch incremental changes since last sync.
   */
  fetchIncrementalData(
    credentials: StoredCredentials,
    cursor?: SyncCursor
  ): Promise<SyncResult>;

  // ── Health ──────────────────────────────────────────────────────────────

  /**
   * Check provider health.
   * Verifies tokens, connectivity, and recent sync status.
   */
  healthcheck(credentials: StoredCredentials): Promise<HealthCheckResult>;
}

// ─── Base Provider Class ────────────────────────────────────────────────────

/**
 * Abstract base class with sensible defaults for providers
 * that don't support all features.
 */
export abstract class BaseProvider implements IntegrationProvider {
  abstract metadata: ProviderMetadata;

  isConfigured(): boolean {
    return true; // Assume true unless specifically validating OAuth
  }

  getAuthorizationUrl(_state: string): string {
    throw new Error(
      `${this.metadata.key} does not support OAuth authorization`
    );
  }

  async exchangeCodeForTokens(_code: string): Promise<OAuthTokens> {
    throw new Error(
      `${this.metadata.key} does not support OAuth token exchange`
    );
  }

  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error(
      `${this.metadata.key} does not support token refresh`
    );
  }

  async revokeAccess(_credentials: StoredCredentials): Promise<void> {
    // Default: no-op (some providers don't support revocation)
  }

  validateWebhook(
    _headers: Record<string, string>,
    _body: string,
    _signingSecret?: string
  ): WebhookValidationResult {
    // Default: accept all (override for production providers)
    return { valid: true };
  }

  normalizeWebhookPayload(
    _eventType: string,
    _payload: any
  ): CanonicalEvent[] {
    return [];
  }

  async fetchInitialData(
    _credentials: StoredCredentials,
    _options?: { lookbackDays?: number }
  ): Promise<SyncResult> {
    return {
      itemsProcessed: 0,
      itemsFailed: 0,
      hasMore: false,
      errors: [{ message: "Initial sync not implemented", retryable: false }],
    };
  }

  async fetchIncrementalData(
    _credentials: StoredCredentials,
    _cursor?: SyncCursor
  ): Promise<SyncResult> {
    return {
      itemsProcessed: 0,
      itemsFailed: 0,
      hasMore: false,
      errors: [
        { message: "Incremental sync not implemented", retryable: false },
      ],
    };
  }

  async healthcheck(
    _credentials: StoredCredentials
  ): Promise<HealthCheckResult> {
    return {
      status: "misconfigured",
      healthPercent: 0,
      message: "Health check not implemented",
      consecutiveFailures: 0,
    };
  }
}
