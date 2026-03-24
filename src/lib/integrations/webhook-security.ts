/**
 * Webhook Security Layer
 *
 * Handles signature validation, rate limiting, idempotency,
 * and payload sanitization for incoming webhooks.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

// ─── Signature Validation ───────────────────────────────────────────────────

/**
 * Validate HMAC-SHA256 signature (used by most providers).
 */
export function validateHmacSignature(
  body: string,
  signature: string,
  secret: string,
  prefix: string = "sha256="
): boolean {
  try {
    const computed = prefix + createHmac("sha256", secret).update(body).digest("hex");
    if (computed.length !== signature.length) return false;
    return timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Validate SHA1 signature (used by some legacy providers).
 */
export function validateSha1Signature(
  body: string,
  signature: string,
  secret: string,
  prefix: string = "sha1="
): boolean {
  try {
    const computed = prefix + createHmac("sha1", secret).update(body).digest("hex");
    if (computed.length !== signature.length) return false;
    return timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

/**
 * Simple in-memory rate limiter for webhooks.
 * In production, use Redis or similar.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // per minute per integration

export function checkRateLimit(
  integrationSlug: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `webhook:${integrationSlug}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);
  return {
    allowed: entry.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining,
    resetAt: entry.resetAt,
  };
}

// ─── Idempotency ────────────────────────────────────────────────────────────

/**
 * Generate a deduplication key from webhook data.
 * Uses provider-specific fields when available, falls back to hash.
 */
export function generateDedupeKey(
  integrationSlug: string,
  eventType: string,
  payload: any
): string {
  // Try provider-specific unique IDs first
  const externalId =
    payload.id ||
    payload.message_id ||
    payload.messageId ||
    payload.event_id ||
    payload.eventId ||
    payload.entry?.[0]?.id ||
    null;

  if (externalId) {
    return `${integrationSlug}:${eventType}:${externalId}`;
  }

  // Fallback: hash the payload
  const { createHash } = require("crypto");
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .substring(0, 16);
  return `${integrationSlug}:${eventType}:hash:${hash}`;
}

/**
 * Check if a webhook event has already been processed.
 * Returns true if duplicate (should be skipped).
 */
export async function isDuplicate(dedupeKey: string): Promise<boolean> {
  // Check in recent webhook events (last 24 hours)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existing = await prisma.webhookEvent.findFirst({
    where: {
      eventType: { contains: dedupeKey.split(":").slice(1).join(":").substring(0, 50) },
      createdAt: { gte: cutoff },
      status: { in: ["received", "processed"] },
    },
  });

  return !!existing;
}

// ─── Payload Sanitization ───────────────────────────────────────────────────

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "api_key",
  "apiKey",
  "authorization",
  "credit_card",
  "ssn",
  "social_security",
]);

/**
 * Validate payload size.
 */
export function validatePayloadSize(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= MAX_PAYLOAD_SIZE;
}

/**
 * Sanitize payload by removing known sensitive fields.
 * Used for logging and storage — NOT for processing.
 */
export function sanitizePayload(payload: any): any {
  if (typeof payload !== "object" || payload === null) return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ─── Webhook Processing Result ──────────────────────────────────────────────

export interface WebhookProcessingResult {
  accepted: boolean;
  eventId?: string;
  reason?: string;
  statusCode: number;
  headers?: Record<string, string>;
}

export function webhookAccepted(eventId: string): WebhookProcessingResult {
  return { accepted: true, eventId, statusCode: 200 };
}

export function webhookRejected(
  reason: string,
  statusCode: number = 400
): WebhookProcessingResult {
  return { accepted: false, reason, statusCode };
}

export function webhookDuplicate(): WebhookProcessingResult {
  return { accepted: true, reason: "duplicate", statusCode: 200 };
}

export function webhookRateLimited(
  resetAt: number
): WebhookProcessingResult {
  return {
    accepted: false,
    reason: "rate_limited",
    statusCode: 429,
    headers: {
      "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString(),
      "X-RateLimit-Remaining": "0",
    },
  };
}
