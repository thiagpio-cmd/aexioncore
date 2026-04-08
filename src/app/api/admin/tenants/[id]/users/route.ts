import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/tenants/[id]/users — List users for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!org) return sendError(notFound("Organization"));

  const users = await prisma.user.findMany({
    where: { organizationId: id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      workspace: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return sendSuccess({ organization: org, users });
}

/**
 * PATCH /api/admin/tenants/[id]/users — Update a user within a tenant
 * Body: { userId, role?, workspace?, isActive?, teamId? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const { userId, role, workspace, isActive, teamId } = body;

  if (!userId) return sendError(badRequest("userId is required"));

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: id },
  });
  if (!user) return sendError(notFound("User"));

  const data: any = {};
  if (role !== undefined) data.role = role;
  if (workspace !== undefined) data.workspace = workspace;
  if (isActive !== undefined) data.isActive = isActive;
  if (teamId !== undefined) data.teamId = teamId;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      workspace: true,
      isActive: true,
    },
  });

  await logAdminAction({
    action: "UPDATE_USER",
    targetType: "user",
    targetId: userId,
    details: { orgId: id, changes: data },
  });

  return sendSuccess(updated);
}
