import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "For individuals exploring the platform",
    tier: "FREE",
    maxSeats: 2,
    maxDeals: 20,
    maxLeads: 50,
    maxStorageMB: 100,
    maxAICallsPerMonth: 20,
    maxIntegrations: 1,
    enabledModules: JSON.stringify(["commercial"]),
    enabledFeatures: JSON.stringify({
      customBranding: false,
      rbacCustom: false,
      apiAccess: false,
      advancedReports: false,
      playbooks: false,
    }),
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    trialDays: 0,
    isPublic: true,
    sortOrder: 0,
  },
  {
    name: "Starter",
    slug: "starter",
    description: "For small teams getting started with CRE revenue operations",
    tier: "STARTER",
    maxSeats: 5,
    maxDeals: 100,
    maxLeads: 500,
    maxStorageMB: 1024,
    maxAICallsPerMonth: 200,
    maxIntegrations: 3,
    enabledModules: JSON.stringify(["commercial", "data", "reports"]),
    enabledFeatures: JSON.stringify({
      customBranding: false,
      rbacCustom: false,
      apiAccess: false,
      advancedReports: false,
      playbooks: false,
    }),
    priceMonthly: 4900, // $49.00
    priceAnnual: 47000, // $470.00 (2 months free)
    currency: "USD",
    trialDays: 14,
    isPublic: true,
    sortOrder: 1,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing brokerages with advanced automation needs",
    tier: "PROFESSIONAL",
    maxSeats: 25,
    maxDeals: 1000,
    maxLeads: 5000,
    maxStorageMB: 10240,
    maxAICallsPerMonth: 2000,
    maxIntegrations: 10,
    enabledModules: JSON.stringify([
      "commercial",
      "data",
      "reports",
      "automation",
      "playbooks",
    ]),
    enabledFeatures: JSON.stringify({
      customBranding: true,
      rbacCustom: true,
      apiAccess: true,
      advancedReports: true,
      playbooks: true,
    }),
    priceMonthly: 14900, // $149.00
    priceAnnual: 143000, // $1,430.00 (2 months free)
    currency: "USD",
    trialDays: 14,
    isPublic: true,
    sortOrder: 2,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For large organizations with custom requirements and unlimited scale",
    tier: "ENTERPRISE",
    maxSeats: -1, // unlimited
    maxDeals: -1,
    maxLeads: -1,
    maxStorageMB: 102400,
    maxAICallsPerMonth: -1,
    maxIntegrations: -1,
    enabledModules: JSON.stringify([
      "commercial",
      "data",
      "reports",
      "automation",
      "post_sale",
      "playbooks",
    ]),
    enabledFeatures: JSON.stringify({
      customBranding: true,
      rbacCustom: true,
      apiAccess: true,
      advancedReports: true,
      playbooks: true,
      sso: true,
      dedicatedSupport: true,
      customIntegrations: true,
    }),
    priceMonthly: 0, // custom pricing
    priceAnnual: 0,
    currency: "USD",
    trialDays: 30,
    isPublic: true,
    sortOrder: 3,
  },
];

/**
 * POST /api/admin/plans/seed — Seed default plans
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const created = [];
    const skipped = [];

    for (const planData of DEFAULT_PLANS) {
      const existing = await prisma.plan.findUnique({
        where: { slug: planData.slug },
      });

      if (existing) {
        skipped.push(planData.slug);
        continue;
      }

      const plan = await prisma.plan.create({ data: planData });
      created.push(plan.slug);
    }

    await logAdminAction({
      action: "CREATE_PLAN",
      targetType: "plan",
      details: { created, skipped, source: "seed" },
    });

    return sendSuccess({
      message: "Plans seeded",
      created,
      skipped,
      total: DEFAULT_PLANS.length,
    });
  } catch (error: any) {
    console.error("POST /api/admin/plans/seed error:", error);
    return sendError(badRequest("Failed to seed plans"));
  }
}
