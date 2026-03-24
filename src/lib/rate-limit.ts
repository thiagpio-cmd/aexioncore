// Simple In-Memory Rate Limiter using a Token Bucket / Window approach
// For MVP only. In production, use Redis (e.g., @upstash/ratelimit).

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

/**
 * Basic memory rate limit checker.
 * @param identifier e.g., IP address or User ID + action
 * @param limit max requests allowed in the window
 * @param windowMs window size in milliseconds
 * @returns boolean `true` if allowed, `false` if rate limited
 */
export function rateLimit(identifier: string, limit: number = 10, windowMs: number = 60000): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }

  if (now > record.resetAt) {
    // Window expired, reset
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, limit, remaining: 0, reset: record.resetAt };
  }

  record.count += 1;
  return { success: true, limit, remaining: limit - record.count, reset: record.resetAt };
}

// Cleanup interval to prevent memory leaks in dev
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();
