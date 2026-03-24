import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { computeAllMetrics } from "@/lib/metrics/business-metrics-engine";
import { isModuleEnabledForOrg } from "@/lib/module-check";

/**
 * GET /api/metrics?period=30
 * Returns all business metrics (volume, conversion, profitability, temporal, rep performance).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    if (!(await isModuleEnabledForOrg(session.user.organizationId, "data"))) {
      return sendError(forbidden("Module not enabled"));
    }

    const period = request.nextUrl.searchParams.get("period");
    const periodDays = period ? parseInt(period, 10) : undefined;

    const metrics = await computeAllMetrics(
      session.user.organizationId,
      periodDays && !isNaN(periodDays) ? periodDays : undefined
    );

    return sendSuccess(metrics);
  } catch (error: any) {
    console.error("GET /api/metrics error:", error);
    return sendError({
      name: "InternalServerError",
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: error.message,
    });
  }
}
