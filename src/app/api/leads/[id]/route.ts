import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { LeadUpdateSchema } from "@/lib/validations/lead";
import { auditUpdate, auditStageChange, auditDelete } from "@/server/audit";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { calculateLeadFit } from "@/lib/scoring/engine";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true, website: true } },
        contact: true,
        meetings: true,
        insights: true,
      },
    });

    if (!lead) return sendError(notFound("Lead"));

    if (!canPerform(actor, "lead", "view", { ownerId: lead.ownerId, organizationId: lead.organizationId })) {
      return sendError(forbidden("You don't have access to this lead"));
    }

    const scoring = calculateLeadFit(lead);

    return sendSuccess({ ...lead, scoring });
  } catch (error: any) {
    console.error("GET /api/leads/[id] error:", error);
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

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return sendError(notFound("Lead"));

    if (!canPerform(actor, "lead", "edit", { ownerId: lead.ownerId, organizationId: lead.organizationId })) {
      return sendError(forbidden("You don't have permission to edit this lead"));
    }

    const body = await request.json();
    const data = LeadUpdateSchema.parse(body);

    // Detect status change
    const statusChanged = data.status && data.status !== lead.status;

    const updatedLead = await prisma.lead.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    // Audit: status change gets its own audit entry + activity record
    if (statusChanged) {
      auditStageChange(session.user.organizationId, session.user.id, "Lead", id, lead.status, data.status!);
      await prisma.activity.create({
        data: {
          type: "STAGE_CHANGE",
          channel: "system",
          leadId: id,
          subject: `Status changed: ${lead.status} → ${data.status}`,
          body: `Lead status changed from "${lead.status}" to "${data.status}"`,
          organizationId: session.user.organizationId,
          creatorId: session.user.id,
        },
      });
    }

    auditUpdate(session.user.organizationId, session.user.id, "Lead", id, lead as any, updatedLead as any);
    return sendSuccess(updatedLead);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid lead data", error.errors));
    console.error("PUT /api/leads/[id] error:", error);
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

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return sendError(notFound("Lead"));

    if (!canPerform(actor, "lead", "delete", { ownerId: lead.ownerId, organizationId: lead.organizationId })) {
      return sendError(forbidden("You don't have permission to delete this lead"));
    }

    await prisma.lead.delete({ where: { id } });
    auditDelete(session.user.organizationId, session.user.id, "Lead", id);
    return sendSuccess({ message: "Lead deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/leads/[id] error:", error);
    return sendUnhandledError();
  }
}
