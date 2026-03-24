import { NextRequest } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";

/**
 * PATCH /api/admin/tenants/[id]
 *
 * Manage a tenant: disable, enable, reset password.
 * Protected by ADMIN_SECRET.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { action, userId, newPassword } = body;

    // Verify org exists
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return sendError(notFound("Organization"));

    switch (action) {
      case "disable": {
        await prisma.user.updateMany({
          where: { organizationId: id },
          data: { isActive: false },
        });
        return sendSuccess({ message: `All users in "${org.name}" disabled`, orgId: id });
      }

      case "enable": {
        await prisma.user.updateMany({
          where: { organizationId: id },
          data: { isActive: true },
        });
        return sendSuccess({ message: `All users in "${org.name}" enabled`, orgId: id });
      }

      case "reset_password": {
        if (!userId || !newPassword) {
          return sendError(badRequest("userId and newPassword are required"));
        }
        if (newPassword.length < 6) {
          return sendError(badRequest("Password must be at least 6 characters"));
        }

        const user = await prisma.user.findFirst({
          where: { id: userId, organizationId: id },
        });
        if (!user) return sendError(notFound("User"));

        const hash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
          where: { id: userId },
          data: { password: hash },
        });

        return sendSuccess({ message: `Password reset for ${user.email}`, userId });
      }

      default:
        return sendError(badRequest(`Unknown action: ${action}`));
    }
  } catch (error: any) {
    console.error("PATCH /api/admin/tenants/[id] error:", error);
    return sendUnhandledError();
  }
}

/**
 * GET /api/admin/tenants/[id]
 *
 * Get detailed info for a specific tenant including all users.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;

    const org = await prisma.organization.findUnique({
      where: { id },
    });

    if (!org) return sendError(notFound("Organization"));

    const [users, teams, pipelines, leadCount, oppCount] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: id },
        select: { id: true, name: true, email: true, role: true, workspace: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.team.findMany({
        where: { organizationId: id },
        select: { id: true, name: true },
      }),
      prisma.pipeline.findMany({
        where: { organizationId: id },
        include: {
          stages: { select: { id: true, name: true, order: true, color: true }, orderBy: { order: "asc" } },
        },
      }),
      prisma.lead.count({ where: { organizationId: id } }),
      prisma.opportunity.count({ where: { organizationId: id } }),
    ]);

    return sendSuccess({
      id: org.id,
      name: org.displayName || org.name,
      slug: org.slug,
      industry: org.industry,
      currency: org.defaultCurrency,
      primaryColor: org.primaryColor,
      secondaryColor: org.secondaryColor,
      logoUrl: org.logoUrl,
      setupCompleted: org.setupCompleted,
      createdAt: org.createdAt,
      users,
      teams,
      pipelines,
      counts: { leads: leadCount, opportunities: oppCount },
    });
  } catch (error: any) {
    console.error("GET /api/admin/tenants/[id] error:", error);
    return sendUnhandledError();
  }
}
