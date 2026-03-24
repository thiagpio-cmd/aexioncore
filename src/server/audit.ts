/**
 * Server-side audit log helper.
 * Writes structured audit log entries for all important CRUD operations.
 */
import { prisma } from "@/lib/db";

interface AuditEntry {
  organizationId: string;
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STAGE_CHANGE" | "LOGIN" | "ASSIGN";
  objectType: string;
  objectId: string;
  details?: Record<string, any>;
  source?: string;
}

/**
 * Write an audit log entry. Non-blocking — errors are caught and logged
 * but never bubble up to the caller.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        objectType: entry.objectType,
        objectId: entry.objectId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        source: entry.source ?? "api",
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

/**
 * Shorthand for a CREATE audit.
 */
export function auditCreate(
  orgId: string,
  userId: string,
  objectType: string,
  objectId: string,
  data?: Record<string, any>
) {
  return writeAuditLog({
    organizationId: orgId,
    userId,
    action: "CREATE",
    objectType,
    objectId,
    details: data ? { after: data } : undefined,
  });
}

/**
 * Shorthand for an UPDATE audit with before/after diff.
 */
export function auditUpdate(
  orgId: string,
  userId: string,
  objectType: string,
  objectId: string,
  before: Record<string, any>,
  after: Record<string, any>
) {
  // Only log fields that actually changed
  const changes: Record<string, { from: any; to: any }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  if (Object.keys(changes).length === 0) return Promise.resolve();

  return writeAuditLog({
    organizationId: orgId,
    userId,
    action: "UPDATE",
    objectType,
    objectId,
    details: { changes },
  });
}

/**
 * Shorthand for a stage change audit.
 */
export function auditStageChange(
  orgId: string,
  userId: string,
  objectType: string,
  objectId: string,
  fromStage: string,
  toStage: string
) {
  return writeAuditLog({
    organizationId: orgId,
    userId,
    action: "STAGE_CHANGE",
    objectType,
    objectId,
    details: { from: fromStage, to: toStage },
  });
}

/**
 * Shorthand for a DELETE audit.
 */
export function auditDelete(
  orgId: string,
  userId: string,
  objectType: string,
  objectId: string
) {
  return writeAuditLog({
    organizationId: orgId,
    userId,
    action: "DELETE",
    objectType,
    objectId,
  });
}
