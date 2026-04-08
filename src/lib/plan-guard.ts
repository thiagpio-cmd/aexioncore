/**
 * Plan Guard — Enforcement layer for subscription limits
 *
 * Every resource-creating action passes through checkPlanLimit()
 * to verify the organization hasn't exceeded their plan quota.
 */

import { prisma } from "./db";

export type PlanMetric =
  | "SEATS"
  | "DEALS"
  | "LEADS"
  | "STORAGE_MB"
  | "AI_CALLS"
  | "API_CALLS"
  | "INTEGRATIONS";

interface PlanCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  metric: PlanMetric;
  planName?: string;
  tier?: string;
  /** Percentage used (0-100) */
  usagePercent: number;
  /** True if usage is above 80% warning threshold */
  warning: boolean;
}

// Metric-to-plan-field mapping
const METRIC_FIELD_MAP: Record<PlanMetric, string> = {
  SEATS: "maxSeats",
  DEALS: "maxDeals",
  LEADS: "maxLeads",
  STORAGE_MB: "maxStorageMB",
  AI_CALLS: "maxAICallsPerMonth",
  API_CALLS: "maxAICallsPerMonth", // shared with AI for now
  INTEGRATIONS: "maxIntegrations",
};

/**
 * Get the active subscription + plan for an organization
 */
export async function getActiveSubscription(organizationId: string) {
  const sub = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return sub;
}

/**
 * Count current usage for a metric
 */
async function getCurrentUsage(
  organizationId: string,
  metric: PlanMetric
): Promise<number> {
  switch (metric) {
    case "SEATS": {
      return prisma.user.count({
        where: { organizationId, isActive: true },
      });
    }
    case "DEALS": {
      return prisma.opportunity.count({
        where: { organizationId },
      });
    }
    case "LEADS": {
      return prisma.lead.count({
        where: { organizationId },
      });
    }
    case "INTEGRATIONS": {
      return prisma.integration.count({
        where: { organizationId, status: { not: "DISCONNECTED" } },
      });
    }
    case "AI_CALLS":
    case "API_CALLS": {
      // Count from usage records for current period
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const records = await prisma.usageRecord.findFirst({
        where: {
          organizationId,
          metric,
          periodStart: { gte: periodStart },
        },
        orderBy: { createdAt: "desc" },
      });
      return records?.quantity ?? 0;
    }
    case "STORAGE_MB": {
      const records = await prisma.usageRecord.findFirst({
        where: { organizationId, metric: "STORAGE_MB" },
        orderBy: { createdAt: "desc" },
      });
      return records?.quantity ?? 0;
    }
    default:
      return 0;
  }
}

/**
 * Check if an organization can perform an action based on plan limits
 */
export async function checkPlanLimit(
  organizationId: string,
  metric: PlanMetric
): Promise<PlanCheckResult> {
  const sub = await getActiveSubscription(organizationId);

  // No subscription = no limits (grace period / legacy)
  if (!sub) {
    return {
      allowed: true,
      current: 0,
      limit: -1, // unlimited
      metric,
      usagePercent: 0,
      warning: false,
    };
  }

  const plan = sub.plan;
  const fieldName = METRIC_FIELD_MAP[metric];
  const planLimit = (plan as any)[fieldName] as number;

  // Check seat override
  const effectiveLimit =
    metric === "SEATS" && sub.seatOverride ? sub.seatOverride : planLimit;

  // -1 or 0 means unlimited for enterprise plans
  if (effectiveLimit <= 0) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      metric,
      planName: plan.name,
      tier: plan.tier,
      usagePercent: 0,
      warning: false,
    };
  }

  const current = await getCurrentUsage(organizationId, metric);
  const usagePercent = Math.round((current / effectiveLimit) * 100);

  return {
    allowed: current < effectiveLimit,
    current,
    limit: effectiveLimit,
    metric,
    planName: plan.name,
    tier: plan.tier,
    usagePercent: Math.min(usagePercent, 100),
    warning: usagePercent >= 80,
  };
}

/**
 * Increment a usage metric (for AI calls, API calls, storage)
 */
export async function incrementUsage(
  organizationId: string,
  metric: PlanMetric,
  amount: number = 1
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const sub = await getActiveSubscription(organizationId);
  const planLimit = sub
    ? (sub.plan as any)[METRIC_FIELD_MAP[metric]] ?? 0
    : 0;

  // Upsert usage record for current period
  const existing = await prisma.usageRecord.findFirst({
    where: {
      organizationId,
      metric,
      periodStart: { gte: periodStart },
    },
  });

  if (existing) {
    const newQuantity = existing.quantity + amount;
    await prisma.usageRecord.update({
      where: { id: existing.id },
      data: {
        quantity: newQuantity,
        overage: Math.max(0, newQuantity - planLimit),
      },
    });
  } else {
    await prisma.usageRecord.create({
      data: {
        organizationId,
        subscriptionId: sub?.id,
        metric,
        quantity: amount,
        limitVal: planLimit,
        overage: Math.max(0, amount - planLimit),
        periodStart,
        periodEnd,
      },
    });
  }
}

/**
 * Check if a specific feature is enabled for an organization
 */
export async function checkFeature(
  organizationId: string,
  feature: string
): Promise<boolean> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) return true; // No subscription = all features (legacy/grace)

  // Check subscription-level overrides first
  if (sub.featureOverrides) {
    try {
      const overrides = JSON.parse(sub.featureOverrides);
      if (feature in overrides) return !!overrides[feature];
    } catch {}
  }

  // Check plan-level features
  if (sub.plan.enabledFeatures) {
    try {
      const features = JSON.parse(sub.plan.enabledFeatures);
      if (feature in features) return !!features[feature];
    } catch {}
  }

  return false;
}

/**
 * Check if a module is enabled for an organization
 */
export async function checkModule(
  organizationId: string,
  moduleName: string
): Promise<boolean> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) return true; // No subscription = all modules (legacy/grace)

  if (sub.plan.enabledModules) {
    try {
      const modules = JSON.parse(sub.plan.enabledModules);
      return Array.isArray(modules) && modules.includes(moduleName);
    } catch {}
  }

  return true; // Default allow
}

/**
 * Get full usage summary for an organization
 */
export async function getUsageSummary(organizationId: string) {
  const sub = await getActiveSubscription(organizationId);
  const metrics: PlanMetric[] = [
    "SEATS",
    "DEALS",
    "LEADS",
    "AI_CALLS",
    "INTEGRATIONS",
    "STORAGE_MB",
  ];

  const results = await Promise.all(
    metrics.map((m) => checkPlanLimit(organizationId, m))
  );

  return {
    subscription: sub
      ? {
          id: sub.id,
          planName: sub.plan.name,
          tier: sub.plan.tier,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPeriodEnd: sub.currentPeriodEnd,
          trialEnd: sub.trialEnd,
        }
      : null,
    usage: Object.fromEntries(results.map((r) => [r.metric, r])),
    hasWarnings: results.some((r) => r.warning),
    hasOverages: results.some((r) => !r.allowed),
  };
}
