/**
 * Environment variable validation.
 *
 * Run at application startup to catch missing configuration early.
 * Logs warnings but does not throw in production to allow
 * degraded operation if non-critical vars are missing.
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

const OPTIONAL_VARS = [
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_GEMINI_API_KEY",
  "ADMIN_SECRET",
] as const;

export interface EnvCheckResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate that required environment variables are set.
 * Logs errors for missing required vars and warnings for missing optional vars.
 *
 * @returns Validation result with lists of missing required and optional vars
 */
export function validateEnvironment(): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check optional vars
  for (const varName of OPTIONAL_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Log results
  if (missing.length > 0) {
    console.error(
      `[ENV CHECK] Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV CHECK] Missing optional environment variables (some features may be degraded): ${warnings.join(", ")}`
    );
  }

  if (missing.length === 0 && warnings.length === 0) {
    console.log("[ENV CHECK] All environment variables are set.");
  }

  // Validate DATABASE_URL format if present
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (
      !dbUrl.startsWith("postgresql://") &&
      !dbUrl.startsWith("postgres://") &&
      !dbUrl.startsWith("mysql://") &&
      !dbUrl.startsWith("file:") &&
      !dbUrl.startsWith("mongodb")
    ) {
      console.warn(
        "[ENV CHECK] DATABASE_URL format may be invalid. Expected a valid database connection string."
      );
    }
  }

  // Validate NEXTAUTH_SECRET strength if present
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    console.warn(
      "[ENV CHECK] NEXTAUTH_SECRET is shorter than 32 characters. Consider using a stronger secret."
    );
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
