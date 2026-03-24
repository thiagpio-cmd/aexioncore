import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { ensureProvidersInitialized } from "@/lib/integrations/init";
import { getCredentials, isExpired, storeCredentials } from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";
import { ingestCanonicalEvents } from "@/lib/integrations/inbox-ingestion-service";
import type {
  StoredCredentials,
  SyncCursor,
  SyncResult,
} from "@/lib/integrations/provider-contract";

type Ctx = { params: Promise<{ id: string }> };

/** Maximum time a sync operation can run before we force-abort (25s for serverless safety) */
const SYNC_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * POST /api/integrations/[id]/sync
 *
 * Trigger a manual sync for an integration.
 * Performs an initial sync if no cursor exists, otherwise incremental.
 *
 * ⚠️  Known limitation: this runs synchronously within the request lifecycle.
 *     For production scale, this should dispatch to a background job queue
 *     (Inngest, QStash, BullMQ). The timeout guard prevents serverless crashes.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  ensureProvidersInitialized();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    if (session.user.role !== "ADMIN") {
      return sendError(forbidden("Only admins can trigger syncs"));
    }

    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) return sendError(notFound("Integration"));
    if (integration.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    if (integration.status !== "CONNECTED") {
      return sendError(
        badRequest("Integration must be connected before syncing")
      );
    }

    const providerKey = integration.providerKey ?? integration.slug;
    const provider = providerRegistry.get(providerKey);
    if (!provider) {
      return sendError(badRequest(`Provider "${providerKey}" is not registered`));
    }

    // Retrieve credentials
    let creds = await getCredentials(id);
    if (!creds) {
      return sendError({
        name: "BadRequest",
        statusCode: 400,
        code: "NO_CREDENTIALS",
        message: "No credentials found. Please reconnect the integration via Settings > Integrations.",
      });
    }

    // Attempt token refresh if expired
    if (isExpired(creds)) {
      if (creds.refreshToken) {
        try {
          console.log(`[Sync] Token expired for ${id}, attempting refresh...`);
          const newTokens = await provider.refreshToken(creds.refreshToken);
          await storeCredentials(id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
          });
          creds = {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
          };
          console.log(`[Sync] Token refreshed successfully for ${id}`);
        } catch (refreshErr: any) {
          console.error(`[Sync] Token refresh failed for ${id}:`, refreshErr.message);
          await prisma.integration.update({
            where: { id },
            data: { status: "ERROR", lastError: "Token refresh failed. Please reconnect." },
          });
          return sendError({
            name: "Unauthorized",
            statusCode: 401,
            code: "TOKEN_REFRESH_FAILED",
            message: "Token refresh failed. Please disconnect and reconnect the integration.",
          });
        }
      } else {
        await prisma.integration.update({
          where: { id },
          data: { status: "ERROR", lastError: "Token expired, no refresh token available." },
        });
        return sendError({
          name: "Unauthorized",
          statusCode: 401,
          code: "TOKEN_EXPIRED",
          message: "Access token has expired and no refresh token is available. Please reconnect the integration.",
        });
      }
    }

    const storedCreds: StoredCredentials = {
      id: id,
      integrationId: id,
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
    };

    // Mark as syncing
    await prisma.integration.update({
      where: { id },
      data: { syncStatus: "syncing" },
    });

    // Determine sync type: initial vs incremental
    let cursor: SyncCursor | undefined;
    if (integration.syncCursor) {
      try {
        cursor = JSON.parse(integration.syncCursor) as SyncCursor;
      } catch {
        // Invalid cursor — fall through to initial sync
      }
    }

    const syncType = cursor ? "incremental" : "initial";
    console.log(JSON.stringify({
      event: "sync.started",
      integrationId: id,
      provider: providerKey,
      type: syncType,
      timestamp: new Date().toISOString(),
    }));

    const syncPromise: Promise<SyncResult> = cursor
      ? provider.fetchIncrementalData(storedCreds, cursor)
      : provider.fetchInitialData(storedCreds);

    const result = await withTimeout(syncPromise, SYNC_TIMEOUT_MS, `${providerKey} sync`);

    // ── PERSIST EVENTS ───────────────────────────────────────────────────────
    // This is the critical step that was previously missing: the provider
    // returned counts but never wrote data to the database. Now we feed the
    // canonical events into the ingestion service which deduplicates and
    // persists them as InboxMessage + Activity rows.
    let ingestionResult = { created: 0, skipped: 0, failed: 0, errors: [] as string[] };
    if (result.events && result.events.length > 0) {
      ingestionResult = await ingestCanonicalEvents(result.events, {
        organizationId: session.user.organizationId,
        integrationId: id,
        ownerId: session.user.id,
      });
    }

    // Persist sync results
    await prisma.integration.update({
      where: { id },
      data: {
        syncStatus: result.errors.length > 0 ? "error" : "idle",
        syncCursor: result.nextCursor
          ? JSON.stringify(result.nextCursor)
          : integration.syncCursor,
        lastSync: new Date(),
        lastSuccessfulSync:
          result.errors.length === 0 ? new Date() : integration.lastSuccessfulSync,
        lastFailedSyncAt:
          result.errors.length > 0 ? new Date() : integration.lastFailedSyncAt,
        lastError: 
          result.errors.length > 0 ? result.errors[0].message : null,
        eventsReceived: { increment: result.itemsProcessed },
        itemsFetched: { increment: result.itemsProcessed },
        itemsPersisted: { increment: ingestionResult.created },
        itemsIgnored: { increment: ingestionResult.skipped },
        itemsFailed: { increment: ingestionResult.failed + result.itemsFailed },
        errorCount:
          result.errors.length > 0
            ? { increment: result.itemsFailed }
            : integration.errorCount,
      },
    });

    // Audit log
    writeAuditLog({
      organizationId: integration.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      objectType: "Integration",
      objectId: id,
      details: {
        action: "manual_sync",
        type: cursor ? "incremental" : "initial",
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
        hasMore: result.hasMore,
        errorCount: result.errors.length,
        ingested: ingestionResult.created,
        ingestionSkipped: ingestionResult.skipped,
        ingestionFailed: ingestionResult.failed,
      },
    });

    return sendSuccess({
      type: cursor ? "incremental" : "initial",
      itemsProcessed: result.itemsProcessed,
      itemsFailed: result.itemsFailed,
      hasMore: result.hasMore,
      errors: result.errors,
      ingestion: {
        created: ingestionResult.created,
        skipped: ingestionResult.skipped,
        failed: ingestionResult.failed,
      },
    });
  } catch (error: any) {
    console.error("POST /api/integrations/[id]/sync error:", error);

    // Attempt to reset sync status on failure
    try {
      const { id } = await ctx.params;
      await prisma.integration.update({
        where: { id },
        data: {
          syncStatus: "error",
          lastError: error.message || "Sync failed",
        },
      });
    } catch {
      // Best-effort
    }

    // Classify error for actionable user messaging
    const msg = error.message || "Sync failed";
    if (msg.includes("Invalid encrypted format") || msg.includes("decrypt")) {
      return sendError({
        name: "BadRequest",
        statusCode: 400,
        code: "CREDENTIAL_CORRUPT",
        message: "Stored credentials are corrupted. Please disconnect and reconnect the integration.",
      });
    }
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid_grant")) {
      return sendError({
        name: "Unauthorized",
        statusCode: 401,
        code: "AUTH_FAILED",
        message: "Authentication failed. Your access may have been revoked. Please reconnect the integration.",
      });
    }
    if (msg.includes("403") || msg.includes("insufficient")) {
      return sendError({
        name: "Forbidden",
        statusCode: 403,
        code: "INSUFFICIENT_SCOPES",
        message: "Insufficient permissions. The integration may need additional scopes. Please reconnect.",
      });
    }
    if (msg.includes("timed out")) {
      return sendError({
        name: "GatewayTimeout",
        statusCode: 504,
        code: "SYNC_TIMEOUT",
        message: "Sync timed out. This may happen with large mailboxes. Try again later.",
      });
    }

    return sendError({
      name: "InternalServerError",
      statusCode: 500,
      code: "SYNC_FAILED",
      message: `Sync failed: ${msg.substring(0, 150)}`,
    });
  }
}
