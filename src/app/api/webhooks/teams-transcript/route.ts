/**
 * Microsoft Teams Transcript Webhook
 *
 * Receives Graph change notifications for callRecords.
 * When a meeting with transcription ends, fetches and processes the transcript.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";
import { getTranscript } from "@/lib/integrations/teams-transcript";
import { getCredentials } from "@/lib/integrations/credential-vault";

export async function POST(request: NextRequest) {
  try {
    // Handle Graph validation handshake
    const validationToken = new URL(request.url).searchParams.get("validationToken");
    if (validationToken) {
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const body = await request.json();
    const notifications = body.value || [];

    for (const notification of notifications) {
      // Validate clientState matches an integration
      const integrationId = notification.clientState;
      if (!integrationId) continue;

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
        select: { id: true, organizationId: true, status: true },
      });

      if (!integration || integration.status !== "CONNECTED") continue;

      const orgId = integration.organizationId;

      // Get credentials
      const creds = await getCredentials(integrationId);
      if (!creds?.accessToken) continue;

      // Extract meeting info from the notification
      const resourceData = notification.resourceData;
      const callRecordId = resourceData?.id;
      if (!callRecordId) continue;

      // Dedup
      const existing = await prisma.meetingTranscript.findFirst({
        where: { organizationId: orgId, externalId: callRecordId },
        select: { id: true },
      });
      if (existing) continue;

      // Fetch call record details to get the meeting ID
      try {
        const callRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${callRecordId}`,
          { headers: { Authorization: `Bearer ${creds.accessToken}` } }
        );

        if (!callRes.ok) continue;

        const callData = await callRes.json();
        const joinWebUrl = callData.joinWebUrl;
        const meetingOrganizerEmail = callData.organizer?.user?.displayName;

        // Try to get the online meeting ID from the join URL
        let meetingId: string | null = null;

        if (joinWebUrl) {
          // List recent meetings and find by join URL
          const meetingsRes = await fetch(
            "https://graph.microsoft.com/v1.0/me/onlineMeetings",
            { headers: { Authorization: `Bearer ${creds.accessToken}` } }
          );

          if (meetingsRes.ok) {
            const meetingsData = await meetingsRes.json();
            const match = (meetingsData.value || []).find(
              (m: any) => m.joinWebUrl === joinWebUrl
            );
            if (match) meetingId = match.id;
          }
        }

        if (!meetingId) continue;

        // Fetch transcript
        const transcriptData = await getTranscript(creds.accessToken, meetingId);
        if (!transcriptData || !transcriptData.transcript) continue;

        // Create transcript record
        const transcript = await prisma.meetingTranscript.create({
          data: {
            organizationId: orgId,
            source: "microsoft_teams",
            externalId: callRecordId,
            title: transcriptData.title,
            rawTranscript: transcriptData.transcript,
            duration: transcriptData.duration,
            participants: JSON.stringify(transcriptData.participants),
          },
        });

        // Fire-and-forget processing
        console.log(`[Teams:Webhook] Created ${transcript.id}, triggering processing`);
        fetch(`${getBaseUrl()}/api/transcripts/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcriptId: transcript.id }),
        })
          .then(async (res) => {
            if (!res.ok) console.error(`[Teams:Webhook] Process HTTP ${res.status} for ${transcript.id}`);
          })
          .catch((err) => {
            console.error(`[Teams:Webhook] Process error for ${transcript.id}:`, err.message);
          });
      } catch (e) {
        console.error(`[Teams:Webhook] Error processing callRecord ${callRecordId}:`, (e as Error).message);
      }
    }

    return NextResponse.json({ status: "processed" }, { status: 202 });
  } catch (error) {
    console.error("[Teams:Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
