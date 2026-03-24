import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { updateIntegrationHealth } from "@/lib/integrations/health-engine";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/integrations/[id]/health
 *
 * Get real-time health status for an integration.
 * Recalculates health from live signals before returning.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) return sendError(notFound("Integration"));
    if (integration.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    const health = await updateIntegrationHealth(id);

    return sendSuccess(health);
  } catch (error: any) {
    console.error("GET /api/integrations/[id]/health error:", error);
    return sendUnhandledError();
  }
}
