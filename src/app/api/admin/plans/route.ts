import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/plans — List all plans
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const plans = await prisma.plan.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  return sendSuccess(plans);
}

/**
 * POST /api/admin/plans — Create a new plan
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const {
      name,
      slug,
      description,
      tier,
      maxSeats,
      maxDeals,
      maxLeads,
      maxStorageMB,
      maxAICallsPerMonth,
      maxIntegrations,
      enabledModules,
      enabledFeatures,
      priceMonthly,
      priceAnnual,
      currency,
      trialDays,
      isPublic,
      sortOrder,
    } = body;

    if (!name || !slug) {
      return sendError(badRequest("name and slug are required"));
    }

    // Check slug uniqueness
    const existing = await prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      return sendError(badRequest(`Plan with slug "${slug}" already exists`));
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        slug,
        description: description || null,
        tier: tier || "STARTER",
        maxSeats: maxSeats ?? 5,
        maxDeals: maxDeals ?? 100,
        maxLeads: maxLeads ?? 500,
        maxStorageMB: maxStorageMB ?? 1024,
        maxAICallsPerMonth: maxAICallsPerMonth ?? 200,
        maxIntegrations: maxIntegrations ?? 3,
        enabledModules: enabledModules
          ? JSON.stringify(enabledModules)
          : '["commercial","data","reports"]',
        enabledFeatures: enabledFeatures
          ? JSON.stringify(enabledFeatures)
          : null,
        priceMonthly: priceMonthly ?? 0,
        priceAnnual: priceAnnual ?? 0,
        currency: currency || "USD",
        trialDays: trialDays ?? 14,
        isPublic: isPublic ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    await logAdminAction({
      action: "CREATE_PLAN",
      targetType: "plan",
      targetId: plan.id,
      details: { name, slug, tier: tier || "STARTER" },
    });

    return sendSuccess(plan, 201);
  } catch (error: any) {
    console.error("POST /api/admin/plans error:", error);
    return sendError(badRequest("Failed to create plan"));
  }
}
