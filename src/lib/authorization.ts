/**
 * Authorization Service — Centralized permission checks.
 *
 * Single source of truth for "who can do what to which resource".
 * No permission logic should live in API routes directly — all routes
 * should call these functions instead.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Resource =
  | "lead"
  | "opportunity"
  | "account"
  | "contact"
  | "task"
  | "meeting"
  | "activity"
  | "insight"
  | "integration"
  | "playbook"
  | "forecast"
  | "dashboard"
  | "analytics"
  | "audit_log"
  | "team"
  | "user"
  | "inbox";

export type Action =
  | "view"
  | "list"
  | "create"
  | "edit"
  | "delete"
  | "convert"
  | "assign"
  | "connect"
  | "disconnect"
  | "export";

export type Scope = "own" | "team" | "organization";

export interface Actor {
  id: string;
  role: string;
  organizationId: string;
  teamId?: string | null;
}

export interface Subject {
  ownerId?: string | null;
  teamId?: string | null;
  organizationId?: string | null;
}

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

const ROLE_LEVEL: Record<string, number> = {
  VIEWER: 0,
  SDR: 1,
  CLOSER: 1,
  REVOPS: 2,
  MANAGER: 3,
  DIRECTOR: 4,
  ADMIN: 5,
};

function roleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

// ─── Permission Matrix ──────────────────────────────────────────────────────
//
// Format: resource → action → minimum role level → scope
// Scope determines data visibility:
//   "own"          = only records where ownerId === actor.id
//   "team"         = records where teamId matches or ownerId matches
//   "organization" = all records in the org

interface PermissionRule {
  minLevel: number;
  scope: Scope;
}

// Default: level 1 (SDR/CLOSER) can view/list/create own,
//          level 3 (MANAGER) can view all in team,
//          level 5 (ADMIN) can do everything in org
const DEFAULT_PERMISSIONS: Record<Action, PermissionRule[]> = {
  view: [
    { minLevel: 1, scope: "own" },
    { minLevel: 3, scope: "team" },
    { minLevel: 4, scope: "organization" },
  ],
  list: [
    { minLevel: 1, scope: "own" },
    { minLevel: 3, scope: "team" },
    { minLevel: 4, scope: "organization" },
  ],
  create: [
    { minLevel: 1, scope: "own" },
    { minLevel: 3, scope: "team" },
    { minLevel: 5, scope: "organization" },
  ],
  edit: [
    { minLevel: 1, scope: "own" },
    { minLevel: 3, scope: "team" },
    { minLevel: 5, scope: "organization" },
  ],
  delete: [
    { minLevel: 3, scope: "own" },
    { minLevel: 5, scope: "organization" },
  ],
  convert: [
    { minLevel: 1, scope: "own" },
    { minLevel: 3, scope: "team" },
  ],
  assign: [
    { minLevel: 3, scope: "team" },
    { minLevel: 5, scope: "organization" },
  ],
  connect: [{ minLevel: 5, scope: "organization" }],
  disconnect: [{ minLevel: 5, scope: "organization" }],
  export: [
    { minLevel: 3, scope: "team" },
    { minLevel: 5, scope: "organization" },
  ],
};

// Resource-specific overrides
const RESOURCE_OVERRIDES: Partial<
  Record<Resource, Partial<Record<Action, PermissionRule[]>>>
> = {
  integration: {
    view: [
      { minLevel: 2, scope: "organization" }, // RevOps+ can view
    ],
    connect: [{ minLevel: 5, scope: "organization" }], // Admin only
    disconnect: [{ minLevel: 5, scope: "organization" }],
    edit: [{ minLevel: 5, scope: "organization" }],
  },
  audit_log: {
    view: [{ minLevel: 3, scope: "organization" }], // Manager+
    list: [{ minLevel: 3, scope: "organization" }],
    create: [], // Nobody creates manually
    edit: [],
    delete: [],
  },
  forecast: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "team" },
      { minLevel: 4, scope: "organization" },
    ],
    edit: [{ minLevel: 3, scope: "team" }],
  },
  dashboard: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "organization" },
    ],
  },
  analytics: {
    view: [{ minLevel: 3, scope: "organization" }],
  },
  team: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "organization" },
    ],
    edit: [{ minLevel: 3, scope: "team" }],
  },
  user: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "organization" },
    ],
    edit: [
      { minLevel: 1, scope: "own" },
      { minLevel: 5, scope: "organization" },
    ],
  },
  task: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "team" },
      { minLevel: 4, scope: "organization" },
    ],
    create: [{ minLevel: 1, scope: "organization" }], // Anyone can create tasks
    edit: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "team" },
    ],
    delete: [
      { minLevel: 1, scope: "own" },
      { minLevel: 5, scope: "organization" },
    ],
  },
  inbox: {
    view: [
      { minLevel: 1, scope: "own" },
      { minLevel: 3, scope: "organization" },
    ],
  },
};

// ─── Core Authorization Functions ───────────────────────────────────────────

/**
 * Check if actor can perform action on resource.
 * Returns the broadest scope the actor has for this action.
 * Returns null if not permitted.
 */
export function getPermissionScope(
  actor: Actor,
  resource: Resource,
  action: Action
): Scope | null {
  const level = roleLevel(actor.role);
  const rules =
    RESOURCE_OVERRIDES[resource]?.[action] ?? DEFAULT_PERMISSIONS[action];

  if (!rules || rules.length === 0) return null;

  // Find the broadest scope the actor qualifies for
  let bestScope: Scope | null = null;
  const scopeOrder: Record<Scope, number> = {
    own: 1,
    team: 2,
    organization: 3,
  };

  for (const rule of rules) {
    if (level >= rule.minLevel) {
      if (!bestScope || scopeOrder[rule.scope] > scopeOrder[bestScope]) {
        bestScope = rule.scope;
      }
    }
  }

  return bestScope;
}

/**
 * Check if actor can perform action on a specific subject.
 */
export function canPerform(
  actor: Actor,
  resource: Resource,
  action: Action,
  subject?: Subject
): boolean {
  const scope = getPermissionScope(actor, resource, action);
  if (!scope) return false;

  // If no subject, just check if action is permitted at all
  if (!subject) return true;

  // Tenant isolation: must be same organization
  if (subject.organizationId && subject.organizationId !== actor.organizationId) {
    return false;
  }

  switch (scope) {
    case "organization":
      return true;
    case "team":
      // Same team or own record
      if (subject.ownerId === actor.id) return true;
      if (subject.teamId && actor.teamId && subject.teamId === actor.teamId)
        return true;
      return false;
    case "own":
      return subject.ownerId === actor.id;
    default:
      return false;
  }
}

/**
 * Build a Prisma where clause for list operations based on scope.
 * Returns the additional filters needed for the actor's permission level.
 */
export function buildScopeFilter(
  actor: Actor,
  resource: Resource
): Record<string, any> {
  const scope = getPermissionScope(actor, resource, "list");

  const base: Record<string, any> = {};

  switch (scope) {
    case "organization":
      // No additional filter needed — org isolation is already applied
      break;
    case "team":
      if (actor.teamId) {
        base.OR = [
          { teamId: actor.teamId },
          { ownerId: actor.id },
        ];
      } else {
        // No team assigned — fall back to own records only
        base.ownerId = actor.id;
      }
      break;
    case "own":
      base.ownerId = actor.id;
      break;
    default:
      // No permission — return impossible filter
      base.id = "__DENIED__";
      break;
  }

  return base;
}

/**
 * Quick check: is this actor at least the given role level?
 */
export function isAtLeast(actor: Actor, role: string): boolean {
  return roleLevel(actor.role) >= roleLevel(role);
}

/**
 * Quick check: is this actor an admin?
 */
export function isAdmin(actor: Actor): boolean {
  return roleLevel(actor.role) >= ROLE_LEVEL.ADMIN;
}

/**
 * Quick check: is this actor a manager or above?
 */
export function isManager(actor: Actor): boolean {
  return roleLevel(actor.role) >= ROLE_LEVEL.MANAGER;
}

/**
 * Extract actor from NextAuth session
 */
export function actorFromSession(session: any): Actor | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    organizationId: session.user.organizationId,
    teamId: session.user.teamId,
  };
}
