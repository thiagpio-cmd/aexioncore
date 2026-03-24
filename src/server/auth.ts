/**
 * Server-side auth helpers.
 * Reusable across all API routes for session, authorization, and tenant context.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/errors";
import { sendError } from "@/lib/api-response";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  workspace: string;
  organizationId: string;
  teamId?: string;
}

/**
 * Get the current authenticated session user or return an error response.
 * Usage:
 *   const [user, errorResponse] = await requireSession();
 *   if (errorResponse) return errorResponse;
 *   // user is guaranteed non-null here
 */
export async function requireSession(): Promise<
  [SessionUser, null] | [null, Response]
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.organizationId) {
    return [null, sendError(unauthorized())];
  }
  return [session.user as SessionUser, null];
}

/**
 * Require a minimum role level.
 * Role hierarchy: USER/SDR/CLOSER < MANAGER < DIRECTOR/ADMIN
 */
const ROLE_LEVELS: Record<string, number> = {
  USER: 1,
  SDR: 1,
  CLOSER: 1,
  VIEWER: 1,
  REVOPS: 2,
  MANAGER: 3,
  DIRECTOR: 4,
  ADMIN: 5,
};

export function requireRole(
  user: SessionUser,
  minimumRole: string
): Response | null {
  const userLevel = ROLE_LEVELS[user.role] ?? 0;
  const requiredLevel = ROLE_LEVELS[minimumRole] ?? 0;
  if (userLevel < requiredLevel) {
    return sendError(forbidden("Insufficient permissions for this action"));
  }
  return null;
}

/**
 * Check if a user can access a specific record.
 * - Regular users (SDR/CLOSER) can only access their own records.
 * - Managers can access records in their team/org.
 * - Admins/Directors can access all records in their org.
 */
export function requireOwnership(
  user: SessionUser,
  recordOwnerId: string | null | undefined,
  recordOrganizationId: string | null | undefined
): Response | null {
  // Must be in the same organization
  if (recordOrganizationId && recordOrganizationId !== user.organizationId) {
    return sendError(forbidden("You don't have access to this resource"));
  }
  // Regular users can only see their own records
  if (ROLE_LEVELS[user.role] <= 1 && recordOwnerId && recordOwnerId !== user.id) {
    return sendError(forbidden("You don't have access to this resource"));
  }
  return null;
}

/**
 * Build a Prisma where clause that enforces tenant isolation.
 * For regular users, also filters by ownerId.
 */
export function tenantWhere(
  user: SessionUser,
  ownerField: string = "ownerId"
): Record<string, string> {
  const where: Record<string, string> = {
    organizationId: user.organizationId,
  };
  if (ROLE_LEVELS[user.role] <= 1) {
    where[ownerField] = user.id;
  }
  return where;
}
