/**
 * Integration Health Engine
 *
 * Health is NOT a static badge. It reflects real operational state:
 * - Token validity
 * - Recent sync success/failure rate
 * - Time since last event
 * - Consecutive errors
 * - Volume expectations
 */

import { prisma } from "@/lib/db";
import type { HealthStatus, HealthCheckResult } from "./provider-contract";

// ─── Configuration ──────────────────────────────────────────────────────────

const STALE_THRESHOLD_HOURS = 24;       // No events in 24h → stale
const DEGRADED_ERROR_THRESHOLD = 3;      // 3+ consecutive errors → degraded
const FAILED_ERROR_THRESHOLD = 10;       // 10+ consecutive errors → failed
const HEALTH_WINDOW_HOURS = 72;          // Evaluate health over last 72h

// ─── Health Calculation ─────────────────────────────────────────────────────

export interface IntegrationHealthInput {
  integrationId: string;
  lastSync: Date | null;
  errorCount: number;
  eventsReceived: number;
  status: string;
  hasCredentials: boolean;
  tokenExpiresAt?: Date | null;
}

/**
 * Calculate health for an integration based on real signals.
 */
export async function calculateHealth(
  input: IntegrationHealthInput
): Promise<HealthCheckResult> {
  // Not connected = misconfigured
  if (input.status !== "connected" && input.status !== "CONNECTED") {
    return {
      status: "misconfigured",
      healthPercent: 0,
      message: "Integration is not connected",
      consecutiveFailures: 0,
    };
  }

  // No credentials = reconnect required
  if (!input.hasCredentials) {
    return {
      status: "reconnect_required",
      healthPercent: 0,
      message: "No credentials found. Please reconnect.",
      consecutiveFailures: 0,
    };
  }

  // Token expired = reconnect required
  if (input.tokenExpiresAt && new Date(input.tokenExpiresAt) < new Date()) {
    return {
      status: "reconnect_required",
      healthPercent: 10,
      message: "Access token expired. Please reconnect.",
      tokenExpiresAt: new Date(input.tokenExpiresAt),
      consecutiveFailures: 0,
    };
  }

  // Get recent webhook events for this integration
  const windowStart = new Date(
    Date.now() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000
  );

  const recentEvents = await prisma.webhookEvent.findMany({
    where: {
      integrationId: input.integrationId,
      createdAt: { gte: windowStart },
    },
    select: {
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalRecent = recentEvents.length;
  const failedRecent = recentEvents.filter(
    (e) => e.status === "failed"
  ).length;
  const successRate =
    totalRecent > 0 ? ((totalRecent - failedRecent) / totalRecent) * 100 : 100;

  // Count consecutive failures (most recent first)
  let consecutiveFailures = 0;
  for (const event of recentEvents) {
    if (event.status === "failed") {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Check staleness
  const hoursSinceLastSync = input.lastSync
    ? (Date.now() - new Date(input.lastSync).getTime()) / (1000 * 60 * 60)
    : Infinity;

  // ── Determine status ────────────────────────────────────────────────────

  let status: HealthStatus = "healthy";
  let healthPercent = 100;
  let message = "All systems operational";

  if (consecutiveFailures >= FAILED_ERROR_THRESHOLD) {
    status = "failed";
    healthPercent = 5;
    message = `${consecutiveFailures} consecutive failures. Integration may need attention.`;
  } else if (consecutiveFailures >= DEGRADED_ERROR_THRESHOLD) {
    status = "degraded";
    healthPercent = Math.max(30, 100 - consecutiveFailures * 10);
    message = `${consecutiveFailures} consecutive failures. Monitoring.`;
  } else if (hoursSinceLastSync > STALE_THRESHOLD_HOURS) {
    status = "stale";
    healthPercent = Math.max(20, 60 - Math.floor(hoursSinceLastSync / 24) * 10);
    message = `No events received in ${Math.floor(hoursSinceLastSync)}h.`;
  } else if (successRate < 90) {
    status = "degraded";
    healthPercent = Math.max(40, Math.floor(successRate));
    message = `Success rate at ${Math.floor(successRate)}% over last ${HEALTH_WINDOW_HOURS}h.`;
  } else {
    // Healthy — calculate exact percent
    healthPercent = Math.floor(
      Math.min(
        100,
        successRate * 0.5 +
          (hoursSinceLastSync < 1 ? 30 : hoursSinceLastSync < 6 ? 25 : 15) +
          (consecutiveFailures === 0 ? 20 : 10) +
          (input.eventsReceived > 0 ? 5 : 0)
      )
    );
  }

  return {
    status,
    healthPercent,
    message,
    lastSuccessfulSync: input.lastSync ?? undefined,
    tokenExpiresAt: input.tokenExpiresAt ?? undefined,
    consecutiveFailures,
  };
}

/**
 * Update integration health in the database.
 */
export async function updateIntegrationHealth(
  integrationId: string
): Promise<HealthCheckResult> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: {
      credentials: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!integration) {
    return {
      status: "misconfigured",
      healthPercent: 0,
      message: "Integration not found",
      consecutiveFailures: 0,
    };
  }

  const health = await calculateHealth({
    integrationId: integration.id,
    lastSync: integration.lastSync,
    errorCount: integration.errorCount,
    eventsReceived: integration.eventsReceived,
    status: integration.status,
    hasCredentials: integration.credentials.length > 0,
    tokenExpiresAt: integration.credentials[0]?.expiresAt,
  });

  // Persist health
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      healthPercent: health.healthPercent,
      status:
        health.status === "reconnect_required"
          ? "RECONNECT_REQUIRED"
          : health.status === "failed"
          ? "ERROR"
          : integration.status,
    },
  });

  return health;
}
