import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { UserUpdateSchema } from "@/lib/validations/user";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "ADMIN");
    if (roleError) return roleError;

    const { id } = await ctx.params;

    // Verify user exists in same org
    const existing = await prisma.user.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return sendError(notFound("User"));

    const body = await request.json();
    const data = UserUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.workspace !== undefined) updateData.workspace = data.workspace;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.teamId !== undefined) updateData.teamId = data.teamId || null;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspace: true,
        isActive: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    return sendSuccess(user);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid user data", error.errors));
    console.error("PATCH /api/users/[id] error:", error);
    return sendUnhandledError();
  }
}
