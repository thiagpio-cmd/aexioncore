/**
 * In-memory session invalidation store.
 *
 * Tracks when a user's sessions were invalidated (e.g. password reset,
 * admin-forced logout). The JWT callback in auth.ts checks this store
 * during periodic re-validation to destroy stale sessions.
 *
 * NOTE: This is an in-memory Map — it resets on server restart.
 * For multi-instance deployments, replace with Redis or a DB table.
 */

const invalidations = new Map<string, number>();

/**
 * Mark all existing sessions for a user as invalid.
 * Any JWT issued before this timestamp will be rejected on next re-validation.
 */
export function invalidateUserSessions(userId: string): void {
  invalidations.set(userId, Date.now());
}

/**
 * Check whether a session (identified by its issued-at timestamp) is still valid.
 * Returns true if no invalidation exists or the session was issued after invalidation.
 */
export function isSessionValid(userId: string, issuedAtMs: number): boolean {
  const invalidatedAt = invalidations.get(userId);
  if (!invalidatedAt) return true;
  return issuedAtMs > invalidatedAt;
}

/**
 * Clear the invalidation record for a user (e.g. after successful re-login).
 */
export function clearInvalidation(userId: string): void {
  invalidations.delete(userId);
}
