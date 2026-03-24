import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Only ADMIN and MANAGER can view audit logs
    if (!["ADMIN", "MANAGER", "DIRECTOR"].includes(session.user.role)) {
      return sendError(unauthorized("Insufficient permissions"));
    }

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return sendSuccess(logs);
  } catch (error: any) {
    console.error("GET /api/audit-logs error:", error);
    return sendUnhandledError();
  }
}
