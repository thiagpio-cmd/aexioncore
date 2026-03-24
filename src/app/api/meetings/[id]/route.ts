import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { MeetingUpdateSchema } from "@/lib/validations/meeting";
import { auditUpdate } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await ctx.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        contact: true,
        lead: { select: { id: true, name: true, status: true } },
      },
    });

    if (!meeting) return sendError(notFound("Meeting"));
    if (meeting.organizationId !== session.user.organizationId) return sendError(forbidden("No access"));
    return sendSuccess(meeting);
  } catch (error: any) {
    console.error("GET /api/meetings/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await ctx.params;

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return sendError(notFound("Meeting"));
    if (meeting.organizationId !== session.user.organizationId) return sendError(forbidden("No access"));

    const body = await request.json();
    const data = MeetingUpdateSchema.parse(body);

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    });

    auditUpdate(session.user.organizationId, session.user.id, "Meeting", id, meeting as any, updated as any);
    return sendSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid data", error.errors));
    console.error("PUT /api/meetings/[id] error:", error);
    return sendUnhandledError();
  }
}
