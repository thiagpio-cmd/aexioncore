/**
 * Google Drive Push Notification Webhook
 *
 * Receives push notifications from Google Drive API when files change.
 * Used to detect new Google Meet transcript files.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";
import { getCredentials } from "@/lib/integrations/credential-vault";
import { checkForTranscripts } from "@/lib/integrations/google-meet-transcript";

export async function POST(request: NextRequest) {
  try {
    const resourceState = request.headers.get("x-goog-resource-state");
    const channelId = request.headers.get("x-goog-channel-id");

    // Initial sync handshake
    if (resourceState === "sync") {
      return NextResponse.json({ status: "sync_ack" }, { status: 200 });
    }

    // Only process updates
    if (resourceState !== "update" && resourceState !== "change") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    if (!channelId) {
      return NextResponse.json({ status: "no_channel" }, { status: 200 });
    }

    // Resolve integration from channel ID (stored as metadata)
    const integration = await prisma.integration.findFirst({
      where: {
        OR: [
          { providerKey: "gmail" },
          { providerKey: "google-calendar" },
        ],
        status: "CONNECTED",
        syncCursor: { contains: channelId },
      },
      select: { id: true, organizationId: true },
    });

    if (!integration) {
      // Fallback: find any connected Google integration
      const fallbackIntegration = await prisma.integration.findFirst({
        where: {
          providerKey: { in: ["gmail", "google-calendar"] },
          status: "CONNECTED",
        },
        select: { id: true, organizationId: true },
      });

      if (!fallbackIntegration) {
        return NextResponse.json({ status: "no_integration" }, { status: 200 });
      }

      return await processGoogleMeetTranscripts(fallbackIntegration.id, fallbackIntegration.organizationId);
    }

    return await processGoogleMeetTranscripts(integration.id, integration.organizationId);
  } catch (error) {
    console.error("[GoogleDrive:Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processGoogleMeetTranscripts(
  integrationId: string,
  orgId: string
): Promise<NextResponse> {
  const creds = await getCredentials(integrationId);
  if (!creds?.accessToken) {
    return NextResponse.json({ status: "no_credentials" }, { status: 200 });
  }

  // Check for transcripts from last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const transcripts = await checkForTranscripts(creds.accessToken, since);

  let created = 0;
  for (const t of transcripts) {
    // Dedup by file ID
    const existing = await prisma.meetingTranscript.findFirst({
      where: { organizationId: orgId, externalId: t.externalId },
      select: { id: true },
    });
    if (existing) continue;

    const record = await prisma.meetingTranscript.create({
      data: {
        organizationId: orgId,
        source: "google_meet",
        externalId: t.externalId,
        title: t.title,
        rawTranscript: t.transcript,
        participants: JSON.stringify(t.participants),
      },
    });

    // Fire-and-forget processing
    console.log(`[GoogleMeet] Created ${record.id}, triggering processing`);
    fetch(`${getBaseUrl()}/api/transcripts/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcriptId: record.id }),
    })
      .then(async (res) => {
        if (!res.ok) console.error(`[GoogleMeet] Process HTTP ${res.status} for ${record.id}`);
      })
      .catch((err) => {
        console.error(`[GoogleMeet] Process error for ${record.id}:`, err.message);
      });

    created++;
  }

  return NextResponse.json(
    { status: "processed", created, checked: transcripts.length },
    { status: 200 }
  );
}
