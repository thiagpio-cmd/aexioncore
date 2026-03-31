/**
 * Error Monitoring — thin wrapper for structured error reporting.
 *
 * Currently logs to console in structured JSON format.
 * Swap internals for Sentry/Datadog/etc. when ready — all call-sites
 * use captureError() so the switch is a single-file change.
 */

import * as Sentry from "@sentry/nextjs";

interface ErrorContext {
  userId?: string;
  organizationId?: string;
  route?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
}

/**
 * Capture and report an error with optional context.
 *
 * In production with Sentry configured, forwards to Sentry.
 * Always logs structured JSON to console for log aggregation.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
  const timestamp = new Date().toISOString();
  const err = error instanceof Error ? error : new Error(String(error));

  // Structured console output (always, for log aggregation)
  const entry: Record<string, unknown> = {
    timestamp,
    level: "error",
    event: "error_captured",
    error: {
      message: err.message,
      name: err.name,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  };

  if (context) {
    entry.context = context;
  }

  console.error(JSON.stringify(entry));

  // Forward to Sentry if available
  try {
    Sentry.captureException(err, {
      extra: context,
    });
  } catch {
    // Sentry not initialized or unavailable — silent fallback
  }
}

/**
 * Capture a warning-level message with context.
 */
export function captureWarning(
  message: string,
  context?: ErrorContext
): void {
  const timestamp = new Date().toISOString();

  const entry: Record<string, unknown> = {
    timestamp,
    level: "warn",
    event: "warning_captured",
    message,
  };

  if (context) {
    entry.context = context;
  }

  console.warn(JSON.stringify(entry));

  try {
    Sentry.captureMessage(message, {
      level: "warning",
      extra: context,
    });
  } catch {
    // Sentry not available — silent fallback
  }
}
