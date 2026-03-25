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

    if (!provider.isConfigured()) {
      return sendError({
        name: "ServiceUnavailable",
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: `${provider.metadata.name} is not configured. Contact your administrator to set up the required credentials.`,
      });
    }

    // Find existing integration record for this provider+org, or create new
    const existing = await prisma.integration.findFirst({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { providerKey },
          { slug: providerKey },
        ],
      },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          status: provider.metadata.authType === "api_key" ? "CONNECTED" : "CONNECTING",
          providerKey,
        },
      });
    } else {
      integration = await prisma.integration.create({
        data: {
          organizationId: session.user.organizationId,
          name: provider.metadata.name,
          slug: `${providerKey}-${session.user.organizationId}`,
          providerKey,
          domain: provider.metadata.domain,
          authType: provider.metadata.authType,
          syncMode: provider.metadata.syncMode,
          status: provider.metadata.authType === "api_key" ? "CONNECTED" : "CONNECTING",
          description: provider.metadata.description,
        },
      });
    }

    // API key providers don't need OAuth — they connect immediately
    if (provider.metadata.authType === "api_key") {
      writeAuditLog({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        objectType: "Integration",
        objectId: integration.id,
        details: { action: "connected_api_key", provider: providerKey },
      });
      return sendSuccess({ integrationId: integration.id, connected: true });
    }

    // OAuth providers — build state token and redirect
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
