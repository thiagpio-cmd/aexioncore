/**
 * Zoom Webhook Receiver
 *
 * Handles:
 * - endpoint.url_validation (Zoom verification challenge)
 * - recording.transcript_completed (new transcript available)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";
import { createHmac } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Handle Zoom URL validation challenge
    if (body.event === "endpoint.url_validation") {
      const plainToken = body.payload?.plainToken;
      const secret = process.env.ZOOM_WEBHOOK_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
      const hashForValidation = createHmac("sha256", secret)
        .update(plainToken)
        .digest("hex");

      return NextResponse.json({
        plainToken,
        encryptedToken: hashForValidation,
      });
    }

    // Validate signature
    const timestamp = request.headers.get("x-zm-request-timestamp");
    const signature = request.headers.get("x-zm-signature");
    const secret = process.env.ZOOM_WEBHOOK_SECRET || process.env.ZOOM_CLIENT_SECRET || "";

    if (timestamp && signature && secret) {
      const message = `v0:${timestamp}:${rawBody}`;
      const expected = `v0=${createHmac("sha256", secret).update(message).digest("hex")}`;
      if (signature !== expected) {
        console.error("[Zoom:Webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Handle transcript completed
    if (body.event === "recording.transcript_completed") {
      const payload = body.payload?.object;
      if (!payload) {
        return NextResponse.json({ status: "no_payload" }, { status: 200 });
      }

      const meetingId = payload.uuid || payload.id;
      const topic = payload.topic || "Zoom Meeting";
      const duration = payload.duration ? payload.duration * 60 : null;
      const hostEmail = payload.host_email;

      // Find integration by host email or Zoom account
      const integration = await prisma.integration.findFirst({
        where: {
          providerKey: "zoom",
          status: "CONNECTED",
        },
        include: {
          credentials: { select: { accessToken: true } },
        },
      });

      if (!integration) {
        console.error("[Zoom:Webhook] No connected Zoom integration");
        return NextResponse.json({ status: "no_integration" }, { status: 200 });
      }

      const orgId = integration.organizationId;

      // Dedup
      if (meetingId) {
        const existing = await prisma.meetingTranscript.findFirst({
          where: { organizationId: orgId, externalId: String(meetingId) },
          select: { id: true },
        });
        if (existing) {
          return NextResponse.json({ id: existing.id, status: "duplicate" });
        }
      }

      // Try to download transcript content
      let transcriptText = "";
      const recordingFiles = payload.recording_files || [];
      const transcriptFile = recordingFiles.find(
        (f: any) => f.file_type === "TRANSCRIPT"
      );

      if (transcriptFile?.download_url && integration.credentials[0]?.accessToken) {
        try {
          const accessToken = integration.credentials[0].accessToken;
          const dlRes = await fetch(
            `${transcriptFile.download_url}?access_token=${accessToken}`
          );
          if (dlRes.ok) {
            const rawText = await dlRes.text();
            // Strip VTT timestamps if present
            transcriptText = rawText
              .replace(/WEBVTT\n\n/g, "")
              .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
          }
        } catch (e) {
          console.error("[Zoom:Webhook] Failed to download transcript:", (e as Error).message);
        }
      }

      if (!transcriptText) {
        transcriptText = `[Zoom transcript for "${topic}" - content pending download]`;
      }

      // Extract participants
      const participants = (payload.participant_users || []).map((p: any) => ({
        name: p.user_name || p.name || "Unknown",
        email: p.email || undefined,
      }));

      // Create transcript
      const transcript = await prisma.meetingTranscript.create({
        data: {
          organizationId: orgId,
          source: "zoom",
          externalId: String(meetingId),
          title: topic,
          rawTranscript: transcriptText,
          duration,
          participants: JSON.stringify(participants),
        },
      });

      // Fire-and-forget processing
      console.log(`[Zoom:Webhook] Created ${transcript.id}, triggering processing`);
      fetch(`${getBaseUrl()}/api/transcripts/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: transcript.id }),
      })
        .then(async (res) => {
          if (!res.ok) console.error(`[Zoom:Webhook] Process HTTP ${res.status} for ${transcript.id}`);
        })
        .catch((err) => {
          console.error(`[Zoom:Webhook] Process error for ${transcript.id}:`, err.message);
        });

      return NextResponse.json({ id: transcript.id, status: "accepted" }, { status: 202 });
    }

    // Unknown event
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (error) {
    console.error("[Zoom:Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
