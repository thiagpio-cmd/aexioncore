import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { convertLeadToOpportunity } from "@/lib/domain/leads/lead-conversion-service";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

const ConvertSchema = z.object({
  opportunityTitle: z.string().min(1),
  opportunityValue: z.number().min(0).default(0),
  stage: z.string().default("DISCOVERY"),
  probability: z.number().min(0).max(100).default(20),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
});

/**
 * POST /api/leads/:id/convert
 * Converts a lead to an opportunity using domain service inside a transaction.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = rateLimit(`convert_lead_${ip}`, 5, 60000);
    if (!success) {
      logger.warn({ event: "RATE_LIMIT_EXCEEDED", route: "/api/leads/[id]/convert", ip });
      return sendError(badRequest("Too many requests"));
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn({ event: "AUTH_FAILURE", route: "/api/leads/[id]/convert", ip });
      return sendError(unauthorized());
    }

    const { id } = await ctx.params;
    const body = await request.json();
    const data = ConvertSchema.safeParse(body);

    if (!data.success) {
      logger.warn({ event: "CONVERSION_VALIDATION_FAILURE", error: data.error, leadId: id });
      return sendError(badRequest("Invalid conversion data", data.error));
    }

    const result = await convertLeadToOpportunity({
      leadId: id,
      organizationId: session.user.organizationId,
      actorId: session.user.id,
      ...data.data,
    });

    return sendSuccess(
      {
        opportunity: result.opportunity,
        account: { id: result.account.id, name: result.account.name },
        lead: { id: result.lead.id, status: result.lead.status },
      },
      201
    );
  } catch (error: any) {
    // Domain errors (e.g., "Cannot convert a lead with status CONVERTED") should be 400, not 500
    if (error?.message?.includes("Cannot convert") || error?.message?.includes("not found")) {
      return sendError(badRequest(error.message));
    }
    logger.error({
      event: "CONVERSION_FAILURE",
      error,
      route: "/api/leads/[id]/convert"
    });
    return sendUnhandledError();
  }
}
