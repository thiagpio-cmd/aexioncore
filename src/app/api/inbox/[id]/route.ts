import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { canPerform, actorFromSession } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());
    
    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;
    const message = await prisma.inboxMessage.findUnique({ where: { id } });

    if (!message) return sendError(notFound("Message"));
    if (message.organizationId !== session.user.organizationId) {
      return sendError(notFound("Message"));
    }
    
    if (!canPerform(actor, "inbox", "view", message)) {
      return sendError(notFound("Message"));
    }

    return sendSuccess(message);
  } catch (error: any) {
    console.error("GET /api/inbox/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());
    
    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;
    const message = await prisma.inboxMessage.findUnique({ where: { id } });

    if (!message) return sendError(notFound("Message"));
    if (message.organizationId !== session.user.organizationId) {
      return sendError(notFound("Message"));
    }
    
    if (!canPerform(actor, "inbox", "edit", message)) {
      return sendError(notFound("Message"));
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.isRead !== undefined) updateData.isRead = body.isRead;
    if (body.starred !== undefined) updateData.starred = body.starred;

    const updated = await prisma.inboxMessage.update({
      where: { id },
      data: updateData,
    });

    return sendSuccess(updated);
  } catch (error: any) {
    console.error("PUT /api/inbox/[id] error:", error);
    return sendUnhandledError();
  }
}
