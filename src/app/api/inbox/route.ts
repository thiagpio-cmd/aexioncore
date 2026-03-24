import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { buildScopeFilter, actorFromSession } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const channel = sp.get("channel");

    const scopeFilter = buildScopeFilter(actor, "inbox");
    const where: any = { 
      organizationId: session.user.organizationId,
      ...scopeFilter
    };
    if (channel && channel !== "all") where.channel = channel.toUpperCase();

    const messages = await prisma.inboxMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return sendSuccess(messages);
  } catch (error: any) {
    console.error("GET /api/inbox error:", error);
    return sendUnhandledError();
  }
}
