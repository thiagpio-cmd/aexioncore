import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { storeCredentials } from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";
import { ensureProvidersInitialized } from "@/lib/integrations/init";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * GET /api/integrations/callback/gmail
 *
 * Static OAuth callback for Gmail. Google requires a fixed redirect URI,
 * so this route serves as the stable endpoint. The integration ID is
 * extracted from the `state` query param (base64url-encoded JSON).
 */
export async function GET(request: NextRequest) {
  ensureProvidersInitialized();

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  console.log("[Gmail Callback] Received callback. code:", !!code, "state:", !!state, "error:", oauthError);

  // Default redirect if we can't determine the integration
  let redirectPath = "/integrations";

  try {
    // Decode and verify HMAC-signed state
    let statePayload: { integrationId: string; userId: string; ts?: number } | null = null;
    if (state) {
      try {
        const [payloadB64, signature] = state.split(".");
        if (!payloadB64 || !signature) throw new Error("Invalid state format");

        // Verify HMAC signature
        const hmacSecret = process.env.NEXTAUTH_SECRET || "";
        const expectedSig = createHmac("sha256", hmacSecret).update(payloadB64).digest("base64url");
        const sigBuffer = Buffer.from(signature, "base64url");
        const expectedBuffer = Buffer.from(expectedSig, "base64url");
        if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
          console.error("[Gmail Callback] HMAC signature verification failed");
          return NextResponse.redirect(
            new URL(`${redirectPath}?error=${encodeURIComponent("Invalid state signature")}`, request.url)
          );
        }

        statePayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
        console.log("[Gmail Callback] Verified state:", JSON.stringify(statePayload));
        if (statePayload?.integrationId) {
          redirectPath = `/integrations/${statePayload.integrationId}`;
        }
      } catch (e) {
        console.error("[Gmail Callback] Failed to decode state:", e);
      }
    }

    // Provider returned an error (e.g. user denied access)
    if (oauthError) {
      const description = searchParams.get("error_description") ?? oauthError;
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent(description)}`, request.url)
      );
    }

    if (!code || !statePayload) {
      console.error("[Gmail Callback] Missing code or state. code:", !!code, "statePayload:", !!statePayload);
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent("Missing code or state parameter")}`, request.url)
      );
    }

    const { integrationId, userId } = statePayload;
    console.log("[Gmail Callback] Looking up integration:", integrationId);

    // Look up the integration
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    console.log("[Gmail Callback] Integration found:", !!integration, integration?.id, integration?.status);
    if (!integration) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent("Integration not found")}`, request.url)
      );
    }

    // Get the provider
    const providerKey = integration.providerKey ?? "gmail";
    const provider = providerRegistry.get(providerKey);
    console.log("[Gmail Callback] Provider found:", !!provider, "key:", providerKey);
    if (!provider) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent("Provider not registered")}`, request.url)
      );
    }

    // Exchange the authorization code for tokens
    const tokens = await provider.exchangeCodeForTokens(code);

    // Store credentials in the vault
    await storeCredentials(integrationId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    // Update integration status
    await prisma.integration.update({
      where: { id: integrationId },
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
      userId,
      action: "CREATE",
      objectType: "IntegrationCredential",
      objectId: integrationId,
      details: { provider: providerKey },
      source: "oauth_callback",
    });

    // Auto-sync: trigger initial sync in background (fire-and-forget)
    const syncUrl = new URL(`/api/integrations/${integrationId}/sync`, request.url);
    fetch(syncUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
    }).catch((err) => console.error("[Gmail Auto-Sync] Failed to trigger:", err));

    return NextResponse.redirect(
      new URL(`${redirectPath}?connected=true`, request.url)
    );
  } catch (error: unknown) {
    console.error("GET /api/integrations/callback/gmail error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(
      new URL(`${redirectPath}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
