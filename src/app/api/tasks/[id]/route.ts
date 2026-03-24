import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { TaskUpdateSchema } from "@/lib/validations/task";
import { auditUpdate, auditDelete } from "@/server/audit";
import { actorFromSession, canPerform } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
      },
    });

    if (!task) return sendError(notFound("Task"));

    if (!canPerform(actor, "task", "view", { ownerId: task.ownerId, organizationId: task.organizationId ?? undefined })) {
      return sendError(forbidden("No access to this task"));
    }

    return sendSuccess(task);
  } catch (error: any) {
    console.error("GET /api/tasks/[id] error:", error);
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

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return sendError(notFound("Task"));

    if (!canPerform(actor, "task", "edit", { ownerId: task.ownerId, organizationId: task.organizationId ?? undefined })) {
      return sendError(forbidden("You don't have permission to edit this task"));
    }

    const body = await request.json();
    const data = TaskUpdateSchema.parse(body);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        completedAt: data.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    auditUpdate(session.user.organizationId, session.user.id, "Task", id, task as any, updated as any);
    return sendSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid data", error.errors));
    console.error("PUT /api/tasks/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return sendError(notFound("Task"));

    if (!canPerform(actor, "task", "delete", { ownerId: task.ownerId, organizationId: task.organizationId ?? undefined })) {
      return sendError(forbidden("You don't have permission to delete this task"));
    }

    await prisma.task.delete({ where: { id } });
    auditDelete(session.user.organizationId, session.user.id, "Task", id);
    return sendSuccess({ message: "Task deleted" });
  } catch (error: any) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return sendUnhandledError();
  }
}
