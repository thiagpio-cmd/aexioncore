import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId: session.user.organizationId,
    };

    const source = sp.get("source");
    if (source) where.source = source;

    const opportunityId = sp.get("opportunityId");
    if (opportunityId) where.opportunityId = opportunityId;

    const leadId = sp.get("leadId");
    if (leadId) where.leadId = leadId;

    const sentiment = sp.get("sentiment");
    if (sentiment) where.sentiment = sentiment;

    const search = sp.get("search");
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const [transcripts, total] = await Promise.all([
      prisma.meetingTranscript.findMany({
        where,
        select: {
          id: true,
          source: true,
          title: true,
          summary: true,
          sentiment: true,
          keyTopics: true,
          duration: true,
          participants: true,
          processedAt: true,
          createdAt: true,
          leadId: true,
          opportunityId: true,
          accountId: true,
          contactId: true,
          meetingId: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.meetingTranscript.count({ where }),
    ]);

    return sendSuccess(transcripts, 200, { page, limit, total });
  } catch (error) {
    console.error("GET /api/transcripts error:", error);
    return sendUnhandledError();
  }
}
