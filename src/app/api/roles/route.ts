import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { requireSession, requireRole } from "@/server/auth";
import { badRequest } from "@/lib/errors";

/**
 * GET /api/roles
 * Returns saved role permission overrides for the current organization.
 * ADMIN-only.
 */
export async function GET() {
  try {
    const [user, errorResponse] = await requireSession();
    if (errorResponse) return errorResponse;

    const roleError = requireRole(user, "ADMIN");
    if (roleError) return roleError;

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { rolePermissions: true },
    });

    const rolePermissions = org?.rolePermissions
      ? JSON.parse(org.rolePermissions)
      : null;

    return sendSuccess({ rolePermissions });
  } catch (error: any) {
    console.error("GET /api/roles error:", error);
    return sendUnhandledError();
  }
}

/**
 * PUT /api/roles
 * Saves role permission overrides for the current organization.
 * ADMIN-only. Expects body: { roles: RoleDef[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const [user, errorResponse] = await requireSession();
    if (errorResponse) return errorResponse;

    const roleError = requireRole(user, "ADMIN");
    if (roleError) return roleError;

    const body = await request.json();

    if (!body.roles || !Array.isArray(body.roles)) {
      return sendError(badRequest("roles array is required"));
    }

    // Validate structure
    for (const role of body.roles) {
      if (!role.role || !role.description || !Array.isArray(role.permissions)) {
        return sendError(
          badRequest(
            "Each role must have role, description, and permissions array"
          )
        );
      }
    }

    await prisma.organization.update({
      where: { id: user.organizationId },
      data: { rolePermissions: JSON.stringify(body.roles) },
    });

    return sendSuccess({ saved: true });
  } catch (error: any) {
    console.error("PUT /api/roles error:", error);
    return sendUnhandledError();
  }
}
