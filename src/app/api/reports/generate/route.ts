import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { reportEngine, ReportInput } from "@/lib/reports";

const VALID_PERIODS = ["7d", "30d", "90d", "365d", "custom"];
const VALID_MODULES = [
  "pipeline",
  "leads",
  "activities",
  "forecast",
  "alerts",
  "recommendations",
  "team",
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Require MANAGER or ADMIN role
    const role = (session.user as any).role;
    if (!["MANAGER", "ADMIN"].includes(role)) {
      return sendError(forbidden("Only managers and admins can generate reports"));
    }

    const body = await request.json();
    const { period, modules, filters, title, periodStart, periodEnd } = body;

    // Validate period
    if (!period || !VALID_PERIODS.includes(period)) {
      return sendError(
        badRequest(`Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}`)
      );
    }

    // Validate modules
    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return sendError(badRequest("modules must be a non-empty array"));
    }
    const invalidModules = modules.filter(
      (m: string) => !VALID_MODULES.includes(m)
    );
    if (invalidModules.length > 0) {
      return sendError(
        badRequest(
          `Invalid modules: ${invalidModules.join(", ")}. Valid: ${VALID_MODULES.join(", ")}`
        )
      );
    }

    // Validate custom period
    if (period === "custom" && (!periodStart || !periodEnd)) {
      return sendError(
        badRequest("periodStart and periodEnd are required for custom period")
      );
    }

    const input: ReportInput = {
      organizationId: (session.user as any).organizationId,
      generatedById: (session.user as any).id,
      period,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      modules,
      filters: filters || undefined,
    };

    const report = await reportEngine.generate(input);

    // Override title if provided
    if (title) {
      report.title = title;
    }

    return sendSuccess(report);
  } catch (error: unknown) {
    console.error("POST /api/reports/generate error:", error);
    return sendUnhandledError();
  }
}
