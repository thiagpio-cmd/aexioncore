/**
 * Centralized base URL resolver.
 *
 * Priority:
 *   1. NEXTAUTH_URL (explicit config — always wins)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (auto-set by Vercel on production)
 *   3. VERCEL_URL (auto-set by Vercel on preview deployments)
 *   4. http://localhost:3000 (local dev fallback)
 */
export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
