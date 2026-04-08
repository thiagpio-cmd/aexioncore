import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/plans/[id] — Get plan detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!plan) return sendError(notFound("Plan"));
  return sendSuccess(plan);
}

/**
 * PATCH /api/admin/plans/[id] — Update plan
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) return sendError(notFound("Plan"));

  const allowedFields = [
    "name",
    "description",
    "tier",
    "maxSeats",
    "maxDeals",
    "maxLeads",
    "maxStorageMB",
    "maxAICallsPerMonth",
    "maxIntegrations",
    "enabledModules",
    "enabledFeatures",
    "priceMonthly",
    "priceAnnual",
    "currency",
    "trialDays",
    "isActive",
    "isPublic",
    "sortOrder",
  ];

  const data: any = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "enabledModules" || field === "enabledFeatures") {
        data[field] = JSON.stringify(body[field]);
      } else {
        data[field] = body[field];
      }
    }
  }

  const plan = await prisma.plan.update({ where: { id }, data });

  await logAdminAction({
    action: "UPDATE_PLAN",
    targetType: "plan",
    targetId: id,
    details: { updatedFields: Object.keys(data) },
  });

  return sendSuccess(plan);
}

/**
 * DELETE /api/admin/plans/[id] — Soft-delete plan (set isActive: false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { id } = await params;

  const existing = await prisma.plan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  });

  if (!existing) return sendError(notFound("Plan"));

  // Don't delete plans with active subscriptions
  if (existing._count.subscriptions > 0) {
    return sendError(
      badRequest(
        `Cannot delete plan with ${existing._count.subscriptions} active subscription(s). Deactivate it instead.`
      )
    );
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: { isActive: false },
  });

  await logAdminAction({
    action: "DELETE_PLAN",
    targetType: "plan",
    targetId: id,
    details: { name: existing.name },
  });

  return sendSuccess({ id: plan.id, deactivated: true });
}
