import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { ensureProvidersInitialized } from "@/lib/integrations/init";
import { writeAuditLog } from "@/server/audit";
import { createHmac } from "crypto";

/**
 * POST /api/integrations/connect
 *
 * Initiate the OAuth flow for a provider.
 * Looks up the provider from the registry and dynamically creates (or updates)
 * the Integration record for the tenant before redirecting.
 */
export async function POST(request: NextRequest) {
  ensureProvidersInitialized();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Only ADMIN can connect integrations
    if (session.user.role !== "ADMIN") {
      return sendError(forbidden("Only admins can connect integrations"));
    }

    const body = await request.json();
    const providerKey = body.providerKey;

    if (!providerKey) {
      return sendError(badRequest("providerKey is required in request body"));
    }

    const provider = providerRegistry.get(providerKey);
    if (!provider) {
      return sendError(badRequest(`Provider "${providerKey}" is not registered`));
    }

    if (provider.metadata.authType !== "oauth2") {
      return sendError(
        badRequest(`Provider "${providerKey}" does not support OAuth.`)
      );
    }

    if (!provider.isConfigured()) {
      return sendError({
        name: "ServiceUnavailable",
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Platform admin has not configured OAuth credentials for this provider.",
      });
    }

    // Upsert the tenant's connection record (plug-and-play instantiation)
    const slug = `${providerKey}-${session.user.organizationId}`;

    const integration = await prisma.integration.upsert({
      where: { slug },
      update: {
        status: "CONNECTING",
      },
      create: {
        organizationId: session.user.organizationId,
        name: provider.metadata.name,
        slug,
        providerKey,
        domain: provider.metadata.domain,
        authType: provider.metadata.authType,
        syncMode: provider.metadata.syncMode,
        status: "CONNECTING",
        description: provider.metadata.description,
      },
    });

    // Build state token: HMAC-signed base64-encoded JSON
    const payload = JSON.stringify({
      integrationId: integration.id,
      userId: session.user.id,
      ts: Date.now(),
    });
    const payloadB64 = Buffer.from(payload).toString("base64url");
    const hmacSecret = process.env.NEXTAUTH_SECRET || "";
    const signature = createHmac("sha256", hmacSecret).update(payloadB64).digest("base64url");
    const state = `${payloadB64}.${signature}`;

    const authorizationUrl = provider.getAuthorizationUrl(state);

    writeAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      objectType: "Integration",
      objectId: integration.id,
      details: { action: "initiate_connection", provider: providerKey },
    });

    return sendSuccess({ authorizationUrl, integrationId: integration.id });
  } catch (error: any) {
    console.error("POST /api/integrations/connect error:", error);
    return sendUnhandledError();
  }
}
