import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform, buildScopeFilter } from "@/lib/authorization";
import { z } from "zod";
import { getBaseUrl } from "@/lib/utils/base-url";

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

    const actor = actorFromSession(session);
    if (!actor || !canPerform(actor, "activity", "list")) {
      return sendError(forbidden("You do not have permission to list activities"));
    }

    const sp = request.nextUrl.searchParams;
    const leadId = sp.get("leadId");
    const opportunityId = sp.get("opportunityId");
    const type = sp.get("type");

    const scopeFilter = buildScopeFilter(actor, "activity");
    const where: any = { organizationId: session.user.organizationId, ...scopeFilter };
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

    const actor = actorFromSession(session);
    if (!actor || !canPerform(actor, "activity", "create")) {
      return sendError(forbidden("You do not have permission to create activities"));
    }

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

    // Fire-and-forget AI processing (don't await, don't block response)
    console.log(`[AI Trigger] Triggering AI processing for activity ${activity.id}`);
    fetch(`${getBaseUrl()}/api/ai/process-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: activity.id }),
    })
      .then(async (res) => {
        if (!res.ok) console.error(`[AI:process-activity] HTTP ${res.status} for activity:${activity.id}`);
      })
      .catch((err) => {
        console.error(`[AI:process-activity] Network error for activity:${activity.id}:`, err.message);
      });

    return sendSuccess(activity, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid activity data", error.errors));
    console.error("POST /api/activities error:", error);
    return sendUnhandledError();
  }
}
