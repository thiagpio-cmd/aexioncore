import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const ActivityCreateSchema = z.object({
  type: z.enum([
    "MESSAGE", "EMAIL", "CALL", "MEETING", "NOTE", "WHATSAPP",
    "STAGE_CHANGE", "TASK_COMPLETED", "FILE_SHARED",
    // Canonical dot-notation types used by domain services
    "lead.converted", "lead.created", "lead.status_changed",
    "opportunity.created", "opportunity.stage_changed",
    "task.created", "task.completed",
  ]),
  channel: z.string().optional().default("internal"),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const leadId = sp.get("leadId");
    const opportunityId = sp.get("opportunityId");
    const type = sp.get("type");

    const where: any = { organizationId: session.user.organizationId };
    if (leadId) where.leadId = leadId;
    if (opportunityId) where.opportunityId = opportunityId;
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return sendSuccess(activities);
  } catch (error: any) {
    console.error("GET /api/activities error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();
    const data = ActivityCreateSchema.parse(body);

    const activity = await prisma.activity.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
        creatorId: session.user.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(activity, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid activity data", error.errors));
    console.error("POST /api/activities error:", error);
    return sendUnhandledError();
  }
}
