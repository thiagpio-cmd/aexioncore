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

    const playbooks = await prisma.playbook.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(playbooks);
  } catch (error: any) {
    console.error("GET /api/playbooks error:", error);
    return sendUnhandledError();
  }
}
