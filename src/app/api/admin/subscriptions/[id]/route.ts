import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/subscriptions/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      plan: true,
      organization: { select: { id: true, name: true, slug: true } },
      usageRecords: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!sub) return sendError(notFound("Subscription"));
  return sendSuccess(sub);
}

/**
 * PATCH /api/admin/subscriptions/[id] — Update, upgrade, downgrade, cancel
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

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true },
  });

  if (!sub) return sendError(notFound("Subscription"));

  switch (action) {
    case "cancel": {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          cancelReason: body.reason || "Admin canceled",
        },
      });
      await logAdminAction({
        action: "CANCEL_SUBSCRIPTION",
        targetType: "subscription",
        targetId: id,
        details: { reason: body.reason, orgId: sub.organizationId },
      });
      return sendSuccess(updated);
    }

    case "activate": {
      const now = new Date();
      const cycle = sub.billingCycle;
      const periodEnd =
        cycle === "ANNUAL"
          ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          canceledAt: null,
          cancelReason: null,
        },
      });
      await logAdminAction({
        action: "UPDATE_SUBSCRIPTION",
        targetType: "subscription",
        targetId: id,
        details: { action: "activate", orgId: sub.organizationId },
      });
      return sendSuccess(updated);
    }

    case "change_plan": {
      if (!body.planId) return sendError(badRequest("planId required for change_plan"));
      const newPlan = await prisma.plan.findUnique({ where: { id: body.planId } });
      if (!newPlan) return sendError(badRequest("New plan not found"));

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          planId: body.planId,
        },
        include: { plan: true },
      });

      // Sync org modules
      if (newPlan.enabledModules) {
        await prisma.organization.update({
          where: { id: sub.organizationId },
          data: { enabledModules: newPlan.enabledModules },
        });
      }

      await logAdminAction({
        action: "UPDATE_SUBSCRIPTION",
        targetType: "subscription",
        targetId: id,
        details: {
          action: "change_plan",
          fromPlan: sub.plan.name,
          toPlan: newPlan.name,
          orgId: sub.organizationId,
        },
      });
      return sendSuccess(updated);
    }

    case "override": {
      const data: any = {};
      if (body.seatOverride !== undefined) data.seatOverride = body.seatOverride;
      if (body.featureOverrides !== undefined)
        data.featureOverrides = JSON.stringify(body.featureOverrides);

      const updated = await prisma.subscription.update({
        where: { id },
        data,
      });
      await logAdminAction({
        action: "OVERRIDE_FEATURE",
        targetType: "subscription",
        targetId: id,
        details: { overrides: body },
      });
      return sendSuccess(updated);
    }

    case "suspend": {
      const updated = await prisma.subscription.update({
        where: { id },
        data: { status: "SUSPENDED" },
      });
      await logAdminAction({
        action: "UPDATE_SUBSCRIPTION",
        targetType: "subscription",
        targetId: id,
        details: { action: "suspend", orgId: sub.organizationId },
      });
      return sendSuccess(updated);
    }

    default:
      return sendError(badRequest("Invalid action. Use: cancel, activate, change_plan, override, suspend"));
  }
}
