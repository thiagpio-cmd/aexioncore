/**
 * POST /api/debriefs/[id]/reject — Reject specific action proposals
 *
 * Body: { proposalIds: string[], reason?: string }
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { rejectActions } from "@/lib/intelligence/debrief-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "edit")) {
      return sendError(forbidden("No permission to reject actions"));
    }

    const { id: debriefId } = await ctx.params;
    const body = await request.json();

    if (!Array.isArray(body.proposalIds) || body.proposalIds.length === 0) {
      return sendError(badRequest("'proposalIds' must be an array with at least one ID"));
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
      return sendError(forbidden("No permission for this opportunity"));
    }

    const result = await rejectActions(
      debriefId,
      body.proposalIds,
      session.user.id,
      session.user.organizationId,
      body.reason
    );

    return sendSuccess({
      message: `${result.rejected} proposal(s) rejected`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/debriefs/[id]/reject error:", error);
    if (error.message?.includes("not found")) {
      return sendError(badRequest(error.message));
    }
    return sendUnhandledError();
  }
}
