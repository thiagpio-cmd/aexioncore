import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "ADMIN");
    if (roleError) return roleError;

    const sp = request.nextUrl.searchParams;
    const status = sp.get("status");

    const where: any = {
      integration: { organizationId: session.user.organizationId },
    };
    if (status && status !== "all") where.status = status;

    const events = await prisma.webhookEvent.findMany({
      where,
      include: {
        integration: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return sendSuccess(events);
  } catch (error: any) {
    console.error("GET /api/webhook-events error:", error);
    return sendUnhandledError();
  }
}
