import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const users = await prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspace: true,
        image: true,
        isActive: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(users);
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return sendUnhandledError();
  }
}
