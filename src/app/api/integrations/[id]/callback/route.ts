import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { storeCredentials } from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/integrations/[id]/callback
 *
 * Handle the OAuth callback from an external provider.
 * This is a browser redirect — the provider sends the user here
 * with `code` and `state` query params.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const baseRedirect = `/integrations/${id}`;

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");

    // Provider returned an error (e.g. user denied access)
    if (oauthError) {
      const description = searchParams.get("error_description") ?? oauthError;
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent(description)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent("Missing code or state parameter")}`, request.url)
      );
    }

    // Decode state to retrieve integrationId and userId
    let statePayload: { integrationId: string; userId: string };
    try {
      statePayload = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8")
      );
    } catch {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent("Invalid state parameter")}`, request.url)
      );
    }

    // Validate state matches the route param
    if (statePayload.integrationId !== id) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent("State mismatch")}`, request.url)
      );
    }

    // Look up the integration
    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent("Integration not found")}`, request.url)
      );
    }

    // Get the provider
    const providerKey = integration.providerKey ?? integration.slug;
    const provider = providerRegistry.get(providerKey);
    if (!provider) {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=${encodeURIComponent("Provider not registered")}`, request.url)
      );
    }

    // Exchange the authorization code for tokens
    const tokens = await provider.exchangeCodeForTokens(code);

    // Store credentials in the vault
    await storeCredentials(id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    // Update integration status
    await prisma.integration.update({
      where: { id },
      data: {
        status: "CONNECTED",
        healthPercent: 100,
        lastSync: new Date(),
        errorCount: 0,
        consecutiveFailures: 0,
      },
    });

    // Audit log
    writeAuditLog({
      organizationId: integration.organizationId,
      userId: statePayload.userId,
      action: "CREATE",
      objectType: "IntegrationCredential",
      objectId: id,
      details: { provider: providerKey },
      source: "oauth_callback",
    });

    return NextResponse.redirect(
      new URL(`${baseRedirect}?connected=true`, request.url)
    );
  } catch (error: any) {
    console.error("GET /api/integrations/[id]/callback error:", error);
    const message = error?.message ?? "OAuth callback failed";
    return NextResponse.redirect(
      new URL(
        `${baseRedirect}?error=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}
