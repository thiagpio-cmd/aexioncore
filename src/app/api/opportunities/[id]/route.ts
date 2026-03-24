import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { OpportunityUpdateSchema } from "@/lib/validations/opportunity";
import { auditUpdate, auditStageChange, auditDelete } from "@/server/audit";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { calculateOpportunityProbability } from "@/lib/scoring/engine";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        account: { include: { company: true } },
        owner: { select: { id: true, name: true, email: true } },
        primaryContact: { select: { id: true, name: true, email: true, title: true } },
        stageRelation: true,
        tasks: { include: { owner: { select: { id: true, name: true } } } },
        insights: true,
      },
    });

    if (!opp) return sendError(notFound("Opportunity"));

    if (!canPerform(actor, "opportunity", "view", { ownerId: opp.ownerId, organizationId: opp.organizationId })) {
      return sendError(forbidden("No access to this opportunity"));
    }

    const scoring = calculateOpportunityProbability(opp);

    return sendSuccess({ ...opp, scoring });
  } catch (error: any) {
    console.error("GET /api/opportunities/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const opp = await prisma.opportunity.findUnique({ where: { id } });
    if (!opp) return sendError(notFound("Opportunity"));

    if (!canPerform(actor, "opportunity", "edit", { ownerId: opp.ownerId, organizationId: opp.organizationId })) {
      return sendError(forbidden("You don't have permission to edit this opportunity"));
    }

    const body = await request.json();
    const data = OpportunityUpdateSchema.parse(body);

    // Detect stage change
    const stageChanged = data.stage && data.stage !== opp.stage;

    // Detect owner change for denormalized field
    let ownerName = opp.ownerName;
    if (data.ownerId && data.ownerId !== opp.ownerId) {
      const newOwner = await prisma.user.findUnique({ where: { id: data.ownerId } });
      if (newOwner) ownerName = newOwner.name;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        ...data,
        ownerName,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    // Audit: stage change gets its own audit entry + activity record
    if (stageChanged) {
      auditStageChange(session.user.organizationId, session.user.id, "Opportunity", id, opp.stage, data.stage!);
      // Create a STAGE_CHANGE activity
      await prisma.activity.create({
        data: {
          type: "STAGE_CHANGE",
          channel: "system",
          opportunityId: id,
          subject: `Stage changed: ${opp.stage} → ${data.stage}`,
          body: `Opportunity stage changed from "${opp.stage}" to "${data.stage}"`,
          organizationId: session.user.organizationId,
          creatorId: session.user.id,
        },
      });
    }

    auditUpdate(session.user.organizationId, session.user.id, "Opportunity", id, opp as any, updated as any);
    return sendSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid data", error.errors));
    console.error("PUT /api/opportunities/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const opp = await prisma.opportunity.findUnique({ where: { id } });
    if (!opp) return sendError(notFound("Opportunity"));

    if (!canPerform(actor, "opportunity", "delete", { ownerId: opp.ownerId, organizationId: opp.organizationId })) {
      return sendError(forbidden("You don't have permission to delete this opportunity"));
    }

    await prisma.opportunity.delete({ where: { id } });
    auditDelete(session.user.organizationId, session.user.id, "Opportunity", id);
    return sendSuccess({ message: "Opportunity deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/opportunities/[id] error:", error);
    return sendUnhandledError();
  }
}
