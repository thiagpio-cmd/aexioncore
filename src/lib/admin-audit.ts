/**
 * Admin Audit Logger
 *
 * Logs all super-admin actions to AdminAuditLog.
 * Separate from per-tenant AuditLog to maintain isolation.
 */

import { prisma } from "./db";

export type AdminAction =
  | "CREATE_PLAN"
  | "UPDATE_PLAN"
  | "DELETE_PLAN"
  | "CREATE_SUBSCRIPTION"
  | "UPDATE_SUBSCRIPTION"
  | "CANCEL_SUBSCRIPTION"
  | "PROVISION_TENANT"
  | "TOGGLE_TENANT"
  | "RESET_PASSWORD"
  | "UPDATE_USER"
  | "GENERATE_LICENSE"
  | "REVOKE_LICENSE"
  | "ACTIVATE_LICENSE"
  | "CREATE_INVOICE"
  | "VOID_INVOICE"
  | "SYNC_USAGE"
  | "OVERRIDE_FEATURE"
  | "VIEW_TENANT_DETAIL";

export type AdminTargetType =
  | "plan"
  | "subscription"
  | "organization"
  | "user"
  | "license_key"
  | "invoice"
  | "usage";

export async function logAdminAction(params: {
  adminIdentifier?: string;
  action: AdminAction;
  targetType: AdminTargetType;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminIdentifier: params.adminIdentifier || "system",
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId || null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    // Never fail the parent operation because of audit logging
    console.error("[AdminAudit] Failed to log action:", err);
  }
}

/**
 * Query admin audit logs with filtering
 */
export async function queryAdminAuditLogs(params: {
  action?: string;
  targetType?: string;
  targetId?: string;
  adminIdentifier?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}) {
  const {
    action,
    targetType,
    targetId,
    adminIdentifier,
    from,
    to,
    page = 1,
    limit = 50,
  } = params;

  const where: any = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (adminIdentifier) where.adminIdentifier = adminIdentifier;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}
