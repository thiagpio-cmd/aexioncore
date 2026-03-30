import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils/base-url";
import { z } from "zod";

const TranscriptionPayloadSchema = z.object({
  source: z.enum(["zoom", "google_meet", "microsoft_teams", "twilio"]),
  externalId: z.string().optional(),
  title: z.string().optional(),
  transcript: z.string().min(1, "Transcript content is required"),
  duration: z.number().optional(),
  participants: z
    .array(
      z.object({
        name: z.string(),
        email: z.string().optional(),
        role: z.string().optional(),
      })
    )
    .optional(),
});

// Rate limit: 20 req/min per org
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook secret
    const webhookSecret = request.headers.get("x-aexion-webhook-secret");
    const expectedSecret =
      process.env.WEBHOOK_TRANSCRIPTION_SECRET || process.env.ADMIN_SECRET;
    if (!webhookSecret || webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Identify tenant
    const orgId = request.headers.get("x-aexion-org-id");
    if (!orgId) {
      return NextResponse.json(
        { error: "x-aexion-org-id header required" },
        { status: 400 }
      );
    }

    // 3. Rate limit
    const now = Date.now();
    const key = `transcript_${orgId}`;
    const entry = rateLimitStore.get(key);
    if (entry && now < entry.resetAt) {
      if (entry.count >= 20) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 }
        );
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + 60000 });
    }

    // 4. Parse and validate
    const body = await request.json();
    const result = TranscriptionPayloadSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }
    const data = result.data;

    // 5. Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 6. Dedup by externalId
    if (data.externalId) {
      const existing = await prisma.meetingTranscript.findFirst({
        where: { organizationId: orgId, externalId: data.externalId },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { id: existing.id, status: "duplicate" },
          { status: 200 }
        );
      }
    }

    // 7. Create transcript (pending processing)
    const transcript = await prisma.meetingTranscript.create({
      data: {
        organizationId: orgId,
        source: data.source,
        externalId: data.externalId || null,
        title: data.title || null,
        rawTranscript: data.transcript,
        duration: data.duration || null,
        participants: data.participants
          ? JSON.stringify(data.participants)
          : null,
      },
    });

    // 8. Fire-and-forget processing
    console.log(
      `[Transcription] Created ${transcript.id}, triggering AI processing`
    );
    fetch(`${getBaseUrl()}/api/transcripts/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcriptId: transcript.id }),
    })
      .then(async (res) => {
        if (!res.ok)
          console.error(
            `[Transcription] Process HTTP ${res.status} for ${transcript.id}`
          );
      })
      .catch((err) => {
        console.error(
          `[Transcription] Process error for ${transcript.id}:`,
          err.message
        );
      });

    // 9. Return 202 Accepted
    return NextResponse.json(
      { id: transcript.id, status: "accepted" },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Webhook:transcription] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
