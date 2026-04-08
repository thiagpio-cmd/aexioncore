import { NextRequest } from "next/server";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { queryAdminAuditLogs } from "@/lib/admin-audit";

/**
 * GET /api/admin/audit — Query admin audit logs
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || undefined;
    const targetType = searchParams.get("targetType") || undefined;
    const targetId = searchParams.get("targetId") || undefined;
    const adminIdentifier = searchParams.get("admin") || undefined;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const result = await queryAdminAuditLogs({
      action,
      targetType,
      targetId,
      adminIdentifier,
      from,
      to,
      page,
      limit,
    });

    return sendSuccess(result.logs, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error: any) {
    console.error("GET /api/admin/audit error:", error);
    return sendError(badRequest("Failed to fetch audit logs"));
  }
}
