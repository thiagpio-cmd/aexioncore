/**
 * In-memory rate limiter for API endpoints.
 *
 * Production-ready, lightweight, no external dependencies.
 * Auto-cleans expired entries every 5 minutes to prevent memory leaks.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether this request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Timestamp (ms) when the current window resets */
  resetAt: number;
}

// ─── Presets ────────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** 5 login attempts per 15 minutes */
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  /** 60 general API requests per minute */
  api: { windowMs: 60 * 1000, maxRequests: 60 },
  /** 20 AI calls per minute */
  ai: { windowMs: 60 * 1000, maxRequests: 20 },
  /** 5 export requests per minute */
  export: { windowMs: 60 * 1000, maxRequests: 5 },
  /** 100 webhook events per minute */
  webhook: { windowMs: 60 * 1000, maxRequests: 100 },
} as const satisfies Record<string, RateLimitConfig>;

// ─── Storage ────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// ─── Core Function ──────────────────────────────────────────────────────────

/**
 * Check and consume a rate limit token.
 *
 * @param key   - Unique identifier (e.g., `login:${ip}`, `ai:${userId}`)
 * @param config - Rate limit configuration (use RATE_LIMITS presets)
 * @returns Whether the request is allowed, remaining count, and reset time
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Window expired or first request — start fresh
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  // Within window — check count
  if (entry.count < config.maxRequests) {
    entry.count += 1;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  // Rate limited
  return {
    allowed: false,
    remaining: 0,
    resetAt: entry.resetAt,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract client IP from a NextRequest.
 * Falls back to "unknown" if no forwarding headers are present.
 */
export function getClientIp(request: { headers: Headers }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Build a standard 429 JSON response with Retry-After header.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const { NextResponse } = require("next/server");
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(retryAfter, 1)),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  );
}

// ─── Auto-Cleanup ───────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

// Only run cleanup in server environment (not during SSR/build)
if (typeof globalThis !== "undefined") {
  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  // Don't prevent Node from exiting
  if (timer && typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}
