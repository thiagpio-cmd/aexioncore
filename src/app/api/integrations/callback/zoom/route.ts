/**
 * Zoom OAuth Callback
 *
 * Handles the redirect from Zoom after user authorizes.
 * Same HMAC state validation pattern as Gmail/Outlook/Slack callbacks.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeCredentials } from "@/lib/integrations/credential-vault";
import { writeAuditLog } from "@/server/audit";
import { zoomProvider } from "@/lib/integrations/providers/zoom";
import { createHmac, timingSafeEqual } from "crypto";
import { getBaseUrl } from "@/lib/utils/base-url";

const redirectPath = "/integrations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=Missing+code+or+state`, request.url)
      );
    }

    // Verify HMAC state
    const [payloadB64, signature] = state.split(".");
    if (!payloadB64 || !signature) throw new Error("Invalid state format");

    const hmacSecret = process.env.HMAC_SECRET || process.env.NEXTAUTH_SECRET || "";
    const expectedSig = createHmac("sha256", hmacSecret).update(payloadB64).digest("base64url");
    const sigBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSig, "base64url");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=Invalid+state+signature`, request.url)
      );
    }

    const stateData = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const integrationId = stateData.integrationId;

    if (!integrationId) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=Missing+integration+ID`, request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await zoomProvider.exchangeCodeForTokens(code);

    // Store encrypted credentials
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
        lastSuccessfulSync: new Date(),
        errorCount: 0,
        consecutiveFailures: 0,
      },
    });

    // Audit log
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      select: { organizationId: true },
    });

    if (integration) {
      writeAuditLog({
        organizationId: integration.organizationId,
        userId: stateData.userId || "system",
        action: "CREATE",
        objectType: "IntegrationCredential",
        objectId: integrationId,
        details: { provider: "zoom" },
        source: "oauth_callback",
      });
    }

    // Fire-and-forget sync
    const syncUrl = new URL(`/api/integrations/${integrationId}/sync`, request.url);
    fetch(syncUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
    }).catch((err) => console.error("[Zoom Auto-Sync] Failed:", err.message));

    return NextResponse.redirect(
      new URL(`${redirectPath}?connected=true`, request.url)
    );
  } catch (error) {
    console.error("GET /api/integrations/callback/zoom error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(
      new URL(`${redirectPath}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
