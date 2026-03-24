import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { AlertEngine } from "@/lib/intelligence/alert-engine";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const orgId = session.user.organizationId;
    const userId = session.user.id;
    const userRole = session.user.role;

    // Non-admin/manager users only see their own alerts
    const isAdmin = ["ADMIN", "MANAGER"].includes(userRole);
    const ownerId = isAdmin ? undefined : userId;

    const engine = new AlertEngine();
    const alerts = await engine.generateAlerts(orgId, ownerId);

    const summary = {
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
      total: alerts.length,
    };

    return sendSuccess({ alerts, summary });
  } catch (error: unknown) {
    console.error("GET /api/alerts/v2 error:", error);
    return sendUnhandledError();
  }
}
