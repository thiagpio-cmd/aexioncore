import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { auditUpdate } from "@/server/audit";
import { canPerform, actorFromSession } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({
      where: { id },
      include: {
        webhooks: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!integration) return sendError(notFound("Integration"));
    if (integration.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    if (!canPerform(actor, "integration", "view", integration)) {
      return sendError(forbidden("No access"));
    }

    return sendSuccess(integration);
  } catch (error: any) {
    console.error("GET /api/integrations/[id] error:", error);
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

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) return sendError(notFound("Integration"));
    if (integration.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    if (!canPerform(actor, "integration", "edit", integration)) {
      return sendError(forbidden("Insufficient permissions to manage integrations"));
    }

    const body = await request.json();
    const { status, description } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;

    // If connecting, set initial health and lastSync
    if (status === "CONNECTED" && integration.status !== "CONNECTED") {
      updateData.healthPercent = 100;
      updateData.lastSync = new Date();
      updateData.errorCount = 0;
    }

    // If disconnecting, reset health
    if (status === "DISCONNECTED") {
      updateData.status = "DISCONNECTED";
      updateData.healthPercent = 0;
      updateData.lastSync = null;
    }

    const updated = await prisma.integration.update({
      where: { id },
      data: updateData,
    });

    if (status === "CONNECTED" && integration.status !== "CONNECTED") {
      await prisma.activity.create({
        data: {
          type: "integration.connected",
          subject: `${updated.name} Connected`,
          body: `Integration ${updated.name} was successfully connected.`,
          creatorId: session.user.id,
          organizationId: session.user.organizationId,
          channel: "system",
        }
      });
    }

    auditUpdate(
      session.user.organizationId,
      session.user.id,
      "Integration",
      id,
      integration as any,
      updated as any
    );

    return sendSuccess(updated);
  } catch (error: any) {
    console.error("PUT /api/integrations/[id] error:", error);
    return sendUnhandledError();
  }
}
