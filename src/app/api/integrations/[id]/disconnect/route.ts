import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import {
  getCredentials,
  revokeCredentials,
} from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";
import type { StoredCredentials } from "@/lib/integrations/provider-contract";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/integrations/[id]/disconnect
 *
 * Disconnect an integration cleanly:
 *   1. Revoke access at the provider (if supported)
 *   2. Delete stored credentials
 *   3. Reset integration status
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    if (session.user.role !== "ADMIN") {
      return sendError(forbidden("Only admins can disconnect integrations"));
    }

    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) return sendError(notFound("Integration"));
    if (integration.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    const providerKey = integration.providerKey ?? integration.slug;
    const provider = providerRegistry.get(providerKey);

    // Attempt to revoke access at the provider level
    if (provider) {
      try {
        const creds = await getCredentials(id);
        if (creds) {
          const storedCreds: StoredCredentials = {
            id: id,
            integrationId: id,
            accessToken: creds.accessToken,
            refreshToken: creds.refreshToken,
          };
          await provider.revokeAccess(storedCreds);
        }
      } catch (revokeError) {
        // Log but don't block — we still want to clean up locally
        console.warn(
          `Provider revocation failed for ${providerKey}:`,
          revokeError
        );
      }
    }

    // Delete stored credentials
    await revokeCredentials(id);

    // Reset integration status
    const updated = await prisma.integration.update({
      where: { id },
      data: {
        status: "DISCONNECTED",
        healthPercent: 0,
        lastSync: null,
        lastSuccessfulSync: null,
        syncCursor: null,
        syncStatus: null,
        nextSyncAt: null,
        errorCount: 0,
        consecutiveFailures: 0,
      },
    });

    // Audit log
    writeAuditLog({
      organizationId: integration.organizationId,
      userId: session.user.id,
      action: "DELETE",
      objectType: "IntegrationCredential",
      objectId: id,
      details: { provider: providerKey },
    });

    return sendSuccess(updated);
  } catch (error: any) {
    console.error("POST /api/integrations/[id]/disconnect error:", error);
    return sendUnhandledError();
  }
}
