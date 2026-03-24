import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/server/audit";

/**
 * GET /api/organization
 * Returns the current tenant's configuration (branding, modules, setup state).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        favicon: true,
        enabledModules: true,
        setupCompleted: true,
        setupStep: true,
        industry: true,
        defaultCurrency: true,
        fiscalYearStart: true,
        timezone: true,
      },
    });

    if (!org) return sendError({ name: "NotFound", statusCode: 404, code: "NOT_FOUND", message: "Organization not found" });

    // Parse enabledModules JSON
    let modules: string[] = [];
    try {
      modules = JSON.parse(org.enabledModules || "[]");
    } catch {
      modules = [];
    }

    return sendSuccess({
      ...org,
      enabledModules: modules,
    });
  } catch (error: any) {
    console.error("GET /api/organization error:", error);
    return sendError({ name: "InternalServerError", statusCode: 500, code: "INTERNAL_ERROR", message: error.message });
  }
}

/**
 * PATCH /api/organization
 * Update tenant configuration. ADMIN only.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());
    if (session.user.role !== "ADMIN") return sendError(forbidden("Only admins can update organization settings"));

    const body = await request.json();

    // Whitelist allowed fields
    const allowed: Record<string, any> = {};
    const fields = [
      "displayName", "logoUrl", "primaryColor", "secondaryColor", "favicon",
      "industry", "defaultCurrency", "fiscalYearStart", "timezone",
      "setupCompleted", "setupStep",
    ];

    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f];
    }

    // Handle enabledModules separately (validate array)
    if (body.enabledModules !== undefined) {
      if (!Array.isArray(body.enabledModules)) {
        return sendError({ name: "BadRequest", statusCode: 400, code: "BAD_REQUEST", message: "enabledModules must be an array" });
      }
      const validModules = ["commercial", "data", "reports", "automation", "post_sale", "playbooks"];
      const filtered = body.enabledModules.filter((m: string) => validModules.includes(m));
      allowed.enabledModules = JSON.stringify(filtered);
    }

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: allowed,
    });

    writeAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      objectType: "Organization",
      objectId: session.user.organizationId,
      details: { fields: Object.keys(allowed) },
      source: "settings",
    });

    let modules: string[] = [];
    try { modules = JSON.parse(updated.enabledModules || "[]"); } catch { modules = []; }

    return sendSuccess({
      ...updated,
      enabledModules: modules,
    });
  } catch (error: any) {
    console.error("PATCH /api/organization error:", error);
    return sendError({ name: "InternalServerError", statusCode: 500, code: "INTERNAL_ERROR", message: error.message });
  }
}
