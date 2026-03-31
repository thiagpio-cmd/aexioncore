/**
 * GET /api/debriefs/[id] — Get a specific debrief with its proposals
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const debrief = await prisma.debrief.findUnique({
      where: { id },
      include: {
        opportunity: {
          select: {
            id: true,
            title: true,
            value: true,
            stage: true,
            probability: true,
            ownerId: true,
            account: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
        actionProposals: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            actionType: true,
            description: true,
            urgency: true,
            params: true,
            financialImpact: true,
            status: true,
            executedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!debrief) return sendError(notFound("Debrief"));

    // Tenant isolation
    if (debrief.organizationId !== session.user.organizationId) {
      return sendError(notFound("Debrief"));
    }

    // RBAC: check if user can view this opportunity's data
    if (!canPerform(actor, "opportunity", "view", {
      ownerId: debrief.opportunity?.ownerId ?? null,
      organizationId: debrief.organizationId,
    })) {
      return sendError(forbidden("Sem permissão para visualizar este debrief"));
    }

    return sendSuccess(debrief);
  } catch (error: any) {
    console.error("GET /api/debriefs/[id] error:", error);
    return sendUnhandledError();
  }
}
