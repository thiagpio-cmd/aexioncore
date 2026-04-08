import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getUsageSummary } from "@/lib/plan-guard";

/**
 * GET /api/admin/usage — Global usage overview across all tenants
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    // Aggregate counts across all orgs
    const [
      totalOrgs,
      totalUsers,
      totalDeals,
      totalLeads,
      totalIntegrations,
      activeSubscriptions,
      trialSubscriptions,
      canceledSubscriptions,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.opportunity.count(),
      prisma.lead.count(),
      prisma.integration.count({ where: { status: { not: "DISCONNECTED" } } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIALING" } }),
      prisma.subscription.count({ where: { status: "CANCELED" } }),
    ]);

    // Per-tier breakdown
    const tierBreakdown = await prisma.subscription.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    // Usage alerts — orgs nearing limits
    const orgsWithSubs = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      select: { organizationId: true, organization: { select: { name: true } } },
    });

    const usageAlerts: Array<{
      orgId: string;
      orgName: string;
      metric: string;
      usagePercent: number;
    }> = [];

    // Check top 20 orgs for alerts (limit for performance)
    for (const orgSub of orgsWithSubs.slice(0, 20)) {
      try {
        const summary = await getUsageSummary(orgSub.organizationId);
        if (summary.hasWarnings || summary.hasOverages) {
          for (const [metric, usage] of Object.entries(summary.usage)) {
            const u = usage as any;
            if (u.warning || !u.allowed) {
              usageAlerts.push({
                orgId: orgSub.organizationId,
                orgName: orgSub.organization.name,
                metric,
                usagePercent: u.usagePercent,
              });
            }
          }
        }
      } catch {}
    }

    return sendSuccess({
      totals: {
        organizations: totalOrgs,
        users: totalUsers,
        deals: totalDeals,
        leads: totalLeads,
        integrations: totalIntegrations,
      },
      subscriptions: {
        active: activeSubscriptions,
        trialing: trialSubscriptions,
        canceled: canceledSubscriptions,
        byStatus: tierBreakdown,
      },
      usageAlerts: usageAlerts.sort(
        (a, b) => b.usagePercent - a.usagePercent
      ),
    });
  } catch (error: any) {
    console.error("GET /api/admin/usage error:", error);
    return sendError(badRequest("Failed to fetch usage data"));
  }
}
