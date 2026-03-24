/**
 * Integration Module — Public API
 *
 * Everything the rest of the app needs from the integration layer.
 */

// Provider contract (interfaces & base class)
export type {
  IntegrationProvider,
  ProviderMetadata,
  ProviderCapabilities,
  IntegrationDomain,
  AuthType,
  SyncMode,
  CanonicalEntityType,
  OAuthConfig,
  OAuthTokens,
  StoredCredentials,
  SyncCursor,
  SyncResult,
  SyncError,
  CanonicalEvent,
  EventDirection,
  EventChannel,
  HealthStatus,
  HealthCheckResult,
  WebhookValidationResult,
} from "./provider-contract";
export { BaseProvider } from "./provider-contract";

// Provider registry
export { providerRegistry } from "./provider-registry";

// Credential vault
export {
  storeCredentials,
  getCredentials,
  revokeCredentials,
  getCredentialInfo,
  isExpired,
  maskToken,
} from "./credential-vault";

// Entity resolution
export {
  resolveEntity,
  resolveEntities,
  normalizePhone,
  extractDomain,
} from "./entity-resolution";
export type { ResolutionInput, ResolutionResult, ResolutionMethod } from "./entity-resolution";

// Webhook security
export {
  validateHmacSignature,
  validateSha1Signature,
  checkRateLimit,
  generateDedupeKey,
  isDuplicate,
  validatePayloadSize,
  sanitizePayload,
  webhookAccepted,
  webhookRejected,
  webhookDuplicate,
  webhookRateLimited,
} from "./webhook-security";
export type { WebhookProcessingResult } from "./webhook-security";

// Health engine
export {
  calculateHealth,
  updateIntegrationHealth,
} from "./health-engine";

// Event taxonomy
export { EVENT_TAXONOMY } from "./event-taxonomy";
