import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { calculateExecutionScore } from "@/lib/intelligence/behavioral-engine";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/users/[id]/execution-score
 *
 * Returns the execution score (0-100) for a user with full breakdown.
 * Auth + tenant isolation enforced.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
    });

    if (!user) return sendError(notFound("User"));

    // Tenant isolation: user must belong to the same organization
    if (user.organizationId !== actor.organizationId) {
      return sendError(forbidden("No access to this user"));
    }

    // Permission check: can view this user's data
    if (
      !canPerform(actor, "user", "view", {
        ownerId: user.id,
        organizationId: user.organizationId,
      })
    ) {
      return sendError(forbidden("No access to this user"));
    }

    const executionScore = await calculateExecutionScore(user.id, user.organizationId);

    return sendSuccess({
      userId: user.id,
      userName: user.name,
      ...executionScore,
    });
  } catch (error: any) {
    console.error("GET /api/users/[id]/execution-score error:", error);
    return sendUnhandledError();
  }
}
