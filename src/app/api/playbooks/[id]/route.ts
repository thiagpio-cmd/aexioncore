import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, badRequest, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { PlaybookUpdateSchema } from "@/lib/validations/playbook";

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

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const { id } = await ctx.params;
    const existing = await prisma.playbook.findUnique({ where: { id } });
    if (!existing) return sendError(notFound("Playbook"));
    if (existing.organizationId && existing.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    const body = await request.json();
    const data = PlaybookUpdateSchema.parse(body);
    const { name, description, segment, stage, steps } = data;

    // Update playbook and replace steps if provided
    const updated = await prisma.$transaction(async (tx) => {
      if (steps && Array.isArray(steps)) {
        await tx.playbookStep.deleteMany({ where: { playbookId: id } });
        await tx.playbookStep.createMany({
          data: steps.map((s, i) => ({
            playbookId: id,
            order: i + 1,
            title: s.title,
            description: s.description || null,
            resources: s.resources || null,
          })),
        });
      }

      return tx.playbook.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(segment !== undefined && { segment }),
          ...(stage !== undefined && { stage }),
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    });

    return sendSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid playbook data", error.errors));
    console.error("PUT /api/playbooks/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "ADMIN");
    if (roleError) return roleError;

    const { id } = await ctx.params;
    const existing = await prisma.playbook.findUnique({ where: { id } });
    if (!existing) return sendError(notFound("Playbook"));
    if (existing.organizationId && existing.organizationId !== session.user.organizationId) {
      return sendError(forbidden("No access"));
    }

    await prisma.playbook.delete({ where: { id } });
    return sendSuccess({ deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/playbooks/[id] error:", error);
    return sendUnhandledError();
  }
}
