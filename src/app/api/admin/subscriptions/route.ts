import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/subscriptions — List all subscriptions
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const orgId = searchParams.get("organizationId");

  const where: any = {};
  if (status) where.status = status;
  if (orgId) where.organizationId = orgId;

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      plan: { select: { id: true, name: true, slug: true, tier: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(subscriptions);
}

/**
 * POST /api/admin/subscriptions — Create/assign a subscription
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organizationId,
      planId,
      billingCycle,
      trialDays,
      seatOverride,
      featureOverrides,
    } = body;

    if (!organizationId || !planId) {
      return sendError(badRequest("organizationId and planId are required"));
    }

    // Validate org exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return sendError(badRequest("Organization not found"));

    // Validate plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return sendError(badRequest("Plan not found"));

    // Cancel existing active subscriptions for this org
    await prisma.subscription.updateMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: "Replaced by new subscription",
      },
    });

    // Calculate periods
    const now = new Date();
    const effectiveTrialDays = trialDays ?? plan.trialDays;
    const isTrialing = effectiveTrialDays > 0;
    const cycle = billingCycle || "MONTHLY";

    let periodEnd: Date;
    if (isTrialing) {
      periodEnd = new Date(
        now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000
      );
    } else if (cycle === "ANNUAL") {
      periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    } else {
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status: isTrialing ? "TRIALING" : "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isTrialing ? now : null,
        trialEnd: isTrialing ? periodEnd : null,
        billingCycle: cycle,
        seatOverride: seatOverride || null,
        featureOverrides: featureOverrides
          ? JSON.stringify(featureOverrides)
          : null,
      },
      include: {
        plan: { select: { id: true, name: true, tier: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    // Update org's enabledModules to match plan
    if (plan.enabledModules) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { enabledModules: plan.enabledModules },
      });
    }

    await logAdminAction({
      action: "CREATE_SUBSCRIPTION",
      targetType: "subscription",
      targetId: subscription.id,
      details: {
        organizationId,
        planName: plan.name,
        tier: plan.tier,
        billingCycle: cycle,
        isTrialing,
      },
    });

    return sendSuccess(subscription, 201);
  } catch (error: any) {
    console.error("POST /api/admin/subscriptions error:", error);
    return sendError(badRequest("Failed to create subscription"));
  }
}
