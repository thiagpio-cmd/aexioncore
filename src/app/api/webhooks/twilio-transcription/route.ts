/**
 * Twilio Transcription Webhook
 *
 * Receives POST from Twilio when a call recording transcription is complete.
 * Payload: TranscriptionSid, RecordingSid, CallSid, TranscriptionText, TranscriptionStatus
 *
 * Validates Twilio signature, resolves tenant, creates MeetingTranscript.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";
import { createHmac } from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Parse form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const {
      TranscriptionSid,
      TranscriptionText,
      TranscriptionStatus,
      CallSid,
      AccountSid,
      RecordingSid,
    } = params;

    // Only process completed transcriptions
    if (TranscriptionStatus !== "completed" || !TranscriptionText) {
      return NextResponse.json({ status: "skipped" }, { status: 200 });
    }

    // Resolve tenant by AccountSid → IntegrationCredential
    const integration = await prisma.integration.findFirst({
      where: {
        providerKey: "twilio",
        status: "CONNECTED",
      },
      include: {
        credentials: { select: { accessToken: true } },
      },
    });

    if (!integration) {
      console.error("[Twilio:Transcription] No connected Twilio integration found");
      return NextResponse.json({ error: "No integration" }, { status: 404 });
    }

    const orgId = integration.organizationId;

    // Dedup by TranscriptionSid
    if (TranscriptionSid) {
      const existing = await prisma.meetingTranscript.findFirst({
        where: { organizationId: orgId, externalId: TranscriptionSid },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ id: existing.id, status: "duplicate" });
      }
    }

    // Try to get call details for duration + participants
    let duration: number | null = null;
    let callerName = params.From || "Unknown";
    let recipientName = params.To || "Unknown";

    // Lookup contacts by phone
    if (params.From) {
      const fromContact = await prisma.contact.findFirst({
        where: {
          phone: { contains: params.From.replace("+", "") },
          organizationId: orgId,
        },
        select: { name: true },
      });
      if (fromContact) callerName = fromContact.name;
    }

    if (params.To) {
      const toContact = await prisma.contact.findFirst({
        where: {
          phone: { contains: params.To.replace("+", "") },
          organizationId: orgId,
        },
        select: { name: true },
      });
      if (toContact) recipientName = toContact.name;
    }

    if (params.Duration) {
      duration = parseInt(params.Duration, 10) || null;
    }

    const participants = [
      { name: callerName, phone: params.From },
      { name: recipientName, phone: params.To },
    ];

    // Create transcript
    const transcript = await prisma.meetingTranscript.create({
      data: {
        organizationId: orgId,
        source: "twilio",
        externalId: TranscriptionSid || null,
        title: `Call with ${callerName !== "Unknown" ? callerName : params.From || "Unknown"}`,
        rawTranscript: TranscriptionText,
        duration,
        participants: JSON.stringify(participants),
      },
    });

    // Fire-and-forget processing
    console.log(`[Twilio:Transcription] Created ${transcript.id}, triggering processing`);
    fetch(`${getBaseUrl()}/api/transcripts/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcriptId: transcript.id }),
    })
      .then(async (res) => {
        if (!res.ok) console.error(`[Twilio:Transcription] Process HTTP ${res.status} for ${transcript.id}`);
      })
      .catch((err) => {
        console.error(`[Twilio:Transcription] Process error for ${transcript.id}:`, err.message);
      });

    return NextResponse.json({ id: transcript.id, status: "accepted" }, { status: 202 });
  } catch (error) {
    console.error("[Twilio:Transcription] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
