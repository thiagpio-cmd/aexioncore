import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateEntity } from "@/lib/automation/rule-engine";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id || !["LEAD", "OPPORTUNITY"].includes(type)) {
      return sendError(badRequest("Invalid entity type or ID. Expected { type: 'LEAD' | 'OPPORTUNITY', id: string }"));
    }

    const result = await evaluateEntity(type as "LEAD" | "OPPORTUNITY", id, session.user.organizationId);

    // Fetch the updated recommendations for this entity
    const recommendations = await prisma.recommendation.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      },
      orderBy: { createdAt: "desc" }
    });

    // Also fetch the system-generated tasks (or all pending tasks)
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "PENDING",
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      },
      orderBy: { dueDate: "asc" }
    });

    return sendSuccess({
      message: "Entity evaluated successfully",
      generated: result,
      recommendations,
      tasks
    });

  } catch (error: any) {
    console.error("POST /api/automation/evaluate error:", error);
    return sendUnhandledError();
  }
}
