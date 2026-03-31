import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { calculateIntentScore, calculateMomentumScore } from "@/lib/intelligence/behavioral-engine";
import { calculateAllMoneyMetrics } from "@/lib/intelligence/money-engine";
import { selectTone, generateNarrativeContext } from "@/lib/intelligence/tone-engine";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/opportunities/[id]/scores
 *
 * Returns behavioral scores (intent, momentum) and tone context for a deal.
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
        title: true,
        value: true,
        probability: true,
        stage: true,
        expectedCloseDate: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        organizationId: true,
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

    // Calculate all scores in parallel
    const [intent, momentum, moneyMetrics] = await Promise.all([
      calculateIntentScore(id),
      calculateMomentumScore(id),
      calculateAllMoneyMetrics(opp),
    ]);

    // Derive tone
    const scores = { intent, momentum };
    const toneSelection = selectTone(moneyMetrics, scores);
    const narrative = generateNarrativeContext(opp, moneyMetrics, scores, toneSelection.mode);

    return sendSuccess({
      intentScore: intent,
      momentumScore: momentum,
      tone: toneSelection,
      narrative,
    });
  } catch (error: any) {
    console.error("GET /api/opportunities/[id]/scores error:", error);
    return sendUnhandledError();
  }
}
