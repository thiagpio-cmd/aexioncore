import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * PATCH /api/admin/licenses/[id] — Revoke, extend, or activate a license
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const license = await prisma.licenseKey.findUnique({ where: { id } });
  if (!license) return sendError(notFound("License key"));

  switch (action) {
    case "revoke": {
      const updated = await prisma.licenseKey.update({
        where: { id },
        data: { status: "REVOKED" },
      });
      await logAdminAction({
        action: "REVOKE_LICENSE",
        targetType: "license_key",
        targetId: id,
        details: { key: license.key },
      });
      return sendSuccess(updated);
    }

    case "extend": {
      if (!body.expiresAt) return sendError(badRequest("expiresAt required for extend"));
      const updated = await prisma.licenseKey.update({
        where: { id },
        data: { expiresAt: new Date(body.expiresAt) },
      });
      return sendSuccess(updated);
    }

    case "activate": {
      if (!body.organizationId) return sendError(badRequest("organizationId required for activate"));

      if (license.currentActivations >= license.maxActivations) {
        return sendError(badRequest("Maximum activations reached for this license"));
      }

      const updated = await prisma.licenseKey.update({
        where: { id },
        data: {
          organizationId: body.organizationId,
          activatedAt: new Date(),
          currentActivations: license.currentActivations + 1,
        },
      });

      await logAdminAction({
        action: "ACTIVATE_LICENSE",
        targetType: "license_key",
        targetId: id,
        details: { key: license.key, orgId: body.organizationId },
      });

      return sendSuccess(updated);
    }

    default:
      return sendError(badRequest("Invalid action. Use: revoke, extend, activate"));
  }
}
