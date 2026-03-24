import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { transitionOpportunityStage } from "@/lib/domain/opportunities/opportunity-stage-transition-service";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const TransitionSchema = z.object({
  targetStage: z.string().min(1),
  note: z.string().optional(),
  nextStepTask: z.object({
    title: z.string().min(1),
    dueDate: z.string().optional(),
  }).optional()
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = rateLimit(`stage_transition_${ip}`, 10, 60000);
    if (!success) {
      logger.warn({ event: "RATE_LIMIT_EXCEEDED", route: "/api/opportunities/[id]/stage-transition", ip });
      return sendError(badRequest("Too many requests"));
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn({ event: "AUTH_FAILURE", route: "/api/opportunities/[id]/stage-transition", ip });
      return sendError(unauthorized());
    }

    const { id } = await ctx.params;
    const body = await request.json();
    const data = TransitionSchema.safeParse(body);

    if (!data.success) {
      logger.warn({ event: "STAGE_TRANSITION_VALIDATION_FAILURE", error: data.error, opportunityId: id });
      return sendError(badRequest(data.error.issues[0].message));
    }

    const result = await transitionOpportunityStage({
      opportunityId: id,
      organizationId: session.user.organizationId,
      actorId: session.user.id,
      ...data.data,
    });

    return sendSuccess(result, 200);
  } catch (error: any) {
    logger.error({ 
      event: "STAGE_TRANSITION_FAILURE", 
      error, 
      route: "/api/opportunities/[id]/stage-transition" 
    });
    return sendUnhandledError();
  }
}
