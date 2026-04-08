import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";

/**
 * GET /api/admin/analytics — Platform analytics overview
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    // Calculate date range
    const now = new Date();
    let fromDate: Date;
    switch (period) {
      case "7d":
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "365d":
        fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      totalOrgs,
      newOrgs,
      totalUsers,
      activeUsers,
      totalDeals,
      newDeals,
      totalLeads,
      newLeads,
      activeSubs,
      totalRevenue,
      planDistribution,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { createdAt: { gte: fromDate } } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.opportunity.count(),
      prisma.opportunity.count({ where: { createdAt: { gte: fromDate } } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: fromDate } } }),
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { amountPaid: true },
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { status: { in: ["ACTIVE", "TRIALING", "CANCELED", "EXPIRED"] } },
      }),
    ]);

    // MRR calculation (sum of active monthly prices)
    const activeSubsWithPlans = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      include: { plan: { select: { priceMonthly: true, priceAnnual: true } } },
    });

    let mrr = 0;
    for (const sub of activeSubsWithPlans) {
      if (sub.billingCycle === "ANNUAL") {
        mrr += Math.round(sub.plan.priceAnnual / 12);
      } else {
        mrr += sub.plan.priceMonthly;
      }
    }

    // Growth — orgs created per month (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const growthData = await prisma.organization.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthlyGrowth: Record<string, number> = {};
    for (const org of growthData) {
      const key = org.createdAt.toISOString().slice(0, 7);
      monthlyGrowth[key] = (monthlyGrowth[key] || 0) + 1;
    }

    // Top tenants by users
    const topTenants = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            opportunities: true,
            leads: true,
          },
        },
      },
      orderBy: { users: { _count: "desc" } },
      take: 10,
    });

    return sendSuccess({
      overview: {
        totalOrgs,
        newOrgs,
        totalUsers,
        activeUsers,
        totalDeals,
        newDeals,
        totalLeads,
        newLeads,
        activeSubscriptions: activeSubs,
        totalRevenue: totalRevenue._sum.amountPaid || 0,
        mrr,
        arr: mrr * 12,
      },
      subscriptionDistribution: planDistribution,
      monthlyGrowth,
      topTenants,
      period,
    });
  } catch (error: any) {
    console.error("GET /api/admin/analytics error:", error);
    return sendError(badRequest("Failed to fetch analytics"));
  }
}
