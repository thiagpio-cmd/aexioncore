import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await ctx.params;

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id },
      include: {
        meeting: { select: { id: true, title: true, startTime: true } },
        lead: { select: { id: true, name: true, email: true } },
        opportunity: {
          select: { id: true, title: true, value: true, stage: true },
        },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, email: true } },
      },
    });

    if (!transcript) return sendError(notFound("Transcript"));

    if (transcript.organizationId !== session.user.organizationId) {
      return sendError(forbidden("Access denied"));
    }

    return sendSuccess(transcript);
  } catch (error) {
    console.error("GET /api/transcripts/[id] error:", error);
    return sendUnhandledError();
  }
}
