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

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const teams = await prisma.team.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(teams);
  } catch (error: any) {
    console.error("GET /api/teams error:", error);
    return sendUnhandledError();
  }
}
