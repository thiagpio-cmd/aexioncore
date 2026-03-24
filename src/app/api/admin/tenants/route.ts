import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendUnhandledError } from "@/lib/api-response";
import { requireAdminSecret } from "@/lib/admin-auth";

/**
 * GET /api/admin/tenants
 *
 * Returns all organizations with user counts and admin info.
 * Protected by ADMIN_SECRET.
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        industry: true,
        defaultCurrency: true,
        primaryColor: true,
        setupCompleted: true,
        createdAt: true,
        _count: { select: { users: true } },
        users: {
          where: { role: "ADMIN" },
          take: 1,
          select: { name: true, email: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tenants = orgs.map((org) => ({
      id: org.id,
      name: org.displayName || org.name,
      slug: org.slug,
      industry: org.industry,
      currency: org.defaultCurrency,
      primaryColor: org.primaryColor,
      userCount: org._count.users,
      setupCompleted: org.setupCompleted,
      createdAt: org.createdAt,
      admin: org.users[0] || null,
      isActive: org.users[0]?.isActive ?? true,
    }));

    return sendSuccess(tenants);
  } catch (error: any) {
    console.error("GET /api/admin/tenants error:", error);
    return sendUnhandledError();
  }
}
