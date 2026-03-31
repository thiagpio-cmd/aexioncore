import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { calculateAllMoneyMetrics } from "@/lib/intelligence/money-engine";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/opportunities/[id]/money
 *
 * Returns money-at-risk metrics for a single opportunity.
 * Auth + tenant isolation enforced.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const opp = await prisma.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        value: true,
        probability: true,
        stage: true,
        expectedCloseDate: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        organizationId: true,
        title: true,
      },
    });

    if (!opp) return sendError(notFound("Opportunity"));

    if (
      !canPerform(actor, "opportunity", "view", {
        ownerId: opp.ownerId,
        organizationId: opp.organizationId,
      })
    ) {
      return sendError(forbidden("No access to this opportunity"));
    }

    const metrics = await calculateAllMoneyMetrics(opp);

    return sendSuccess(metrics);
  } catch (error: any) {
    console.error("GET /api/opportunities/[id]/money error:", error);
    return sendUnhandledError();
  }
}
