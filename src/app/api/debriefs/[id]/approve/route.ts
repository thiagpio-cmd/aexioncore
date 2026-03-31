/**
 * POST /api/debriefs/[id]/approve — Approve specific action proposals
 *
 * Body: { proposalIds: string[] }
 * Approved proposals are executed (create tasks, update stages, etc.)
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { approveActions } from "@/lib/intelligence/debrief-service";
import { auditCreate } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "edit")) {
      return sendError(forbidden("Sem permissão para aprovar ações"));
    }

    const { id: debriefId } = await ctx.params;
    const body = await request.json();

    if (!Array.isArray(body.proposalIds) || body.proposalIds.length === 0) {
      return sendError(badRequest("'proposalIds' deve ser um array com ao menos um ID"));
    }

    // Validate debrief exists and belongs to this org
    const debrief = await prisma.debrief.findUnique({
      where: { id: debriefId },
      select: {
        id: true,
        organizationId: true,
        opportunity: { select: { ownerId: true } },
      },
    });

    if (!debrief) return sendError(notFound("Debrief"));

    if (debrief.organizationId !== session.user.organizationId) {
      return sendError(notFound("Debrief"));
    }

    // RBAC on the opportunity
    if (!canPerform(actor, "opportunity", "edit", {
      ownerId: debrief.opportunity?.ownerId ?? null,
      organizationId: debrief.organizationId,
    })) {
      return sendError(forbidden("Sem permissão para esta oportunidade"));
    }

    const result = await approveActions(
      debriefId,
      body.proposalIds,
      session.user.id,
      session.user.organizationId
    );

    auditCreate(
      session.user.organizationId,
      session.user.id,
      "DebriefApproval",
      debriefId,
      { proposalIds: body.proposalIds, approved: result.approved, executed: result.executed }
    );

    return sendSuccess({
      message: `${result.approved} proposta(s) aprovada(s), ${result.executed} executada(s)`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/debriefs/[id]/approve error:", error);
    if (error.message?.includes("não encontrad") || error.message?.includes("válida")) {
      return sendError(badRequest(error.message));
    }
    return sendUnhandledError();
  }
}
