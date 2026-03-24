import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await ctx.params;

    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
    });

    if (!playbook) return sendError(notFound("Playbook"));
    if (playbook.organizationId && playbook.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    return sendSuccess(playbook);
  } catch (error: any) {
    console.error("GET /api/playbooks/[id] error:", error);
    return sendUnhandledError();
  }
}
