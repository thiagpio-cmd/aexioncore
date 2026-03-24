import {
  UserRole,
  WorkspaceType,
  type NavItem,
} from "@/types";

// ─── Workspace Configuration ─────────────────────────────────────────────────

export const WORKSPACE_CONFIG: Record<
  WorkspaceType,
  { label: string; description: string; color: string; icon: string }
> = {
  [WorkspaceType.SDR]: {
    label: "SDR Workspace",
    description: "Lead prospecting, qualification, and outreach",
    color: "bg-blue-500",
    icon: "phone",
  },
  [WorkspaceType.CLOSER]: {
    label: "Closer Workspace",
    description: "Deal management, negotiation, and closing",
    color: "bg-purple-500",
    icon: "target",
  },
  [WorkspaceType.MANAGER]: {
    label: "Manager Workspace",
    description: "Team performance, coaching, and pipeline review",
    color: "bg-emerald-500",
    icon: "users",
  },
  [WorkspaceType.EXECUTIVE]: {
    label: "Executive Workspace",
    description: "Revenue forecasting, strategy, and organizational insights",
    color: "bg-amber-500",
    icon: "bar-chart",
  },
};

// ─── Role Labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SDR]: "SDR",
  [UserRole.CLOSER]: "Closer",
  [UserRole.MANAGER]: "Manager",
  [UserRole.DIRECTOR]: "Director",
  [UserRole.ADMIN]: "Admin",
  [UserRole.REVOPS]: "RevOps",
  [UserRole.VIEWER]: "Viewer",
};

// ─── Lead Statuses ───────────────────────────────────────────────────────────

export const LEAD_STATUSES: Record<string, { label: string; color: string }> = {
  NEW: { label: "New", color: "bg-blue-100 text-blue-700" },
  CONTACTED: { label: "Contacted", color: "bg-indigo-100 text-indigo-700" },
  QUALIFIED: { label: "Qualified", color: "bg-emerald-100 text-emerald-700" },
  UNQUALIFIED: { label: "Unqualified", color: "bg-gray-100 text-gray-700" },
  CONVERTED: { label: "Converted", color: "bg-purple-100 text-purple-700" },
};

// ─── Opportunity Stages ──────────────────────────────────────────────────────

export const OPPORTUNITY_STAGES: Record<
  string,
  { label: string; color: string; order: number }
> = {
  DISCOVERY: { label: "Discovery", color: "bg-blue-500", order: 1 },
  QUALIFICATION: { label: "Qualification", color: "bg-indigo-500", order: 2 },
  PROPOSAL: { label: "Proposal", color: "bg-purple-500", order: 3 },
  NEGOTIATION: { label: "Negotiation", color: "bg-amber-500", order: 4 },
  CLOSED_WON: { label: "Closed Won", color: "bg-emerald-500", order: 5 },
  CLOSED_LOST: { label: "Closed Lost", color: "bg-red-500", order: 6 },
};

// ─── Task Types ──────────────────────────────────────────────────────────────

export const TASK_TYPES: Record<string, { label: string; icon: string }> = {
  FOLLOW_UP: { label: "Follow Up", icon: "reply" },
  CALL: { label: "Call", icon: "phone" },
  WHATSAPP: { label: "WhatsApp", icon: "message-circle" },
  EMAIL: { label: "Email", icon: "mail" },
  MEETING: { label: "Meeting", icon: "calendar" },
  REVIEW: { label: "Review", icon: "eye" },
  APPROVAL: { label: "Approval", icon: "check-circle" },
  UPDATE: { label: "Update", icon: "edit" },
};

// ─── Activity Types ──────────────────────────────────────────────────────────

export const ACTIVITY_TYPES: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  MESSAGE: { label: "Message", icon: "message-circle", color: "text-blue-500" },
  EMAIL: { label: "Email", icon: "mail", color: "text-indigo-500" },
  CALL: { label: "Call", icon: "phone", color: "text-emerald-500" },
  MEETING: { label: "Meeting", icon: "calendar", color: "text-purple-500" },
  NOTE: { label: "Note", icon: "file-text", color: "text-gray-500" },
  STAGE_CHANGE: { label: "Stage Change", icon: "arrow-right", color: "text-amber-500" },
  TASK_COMPLETED: { label: "Task Completed", icon: "check-circle", color: "text-emerald-500" },
  APPROVAL: { label: "Approval", icon: "shield-check", color: "text-purple-500" },
  SYSTEM: { label: "System", icon: "cpu", color: "text-gray-400" },
};

// ─── Insight Types ───────────────────────────────────────────────────────────

export const INSIGHT_TYPES: Record<string, { label: string }> = {
  STALE_LEAD: { label: "Stale Lead" },
  STUCK_DEAL: { label: "Stuck Deal" },
  RECURRING_OBJECTION: { label: "Recurring Objection" },
  WEAK_CHAMPION: { label: "Weak Champion" },
  NO_NEXT_STEP: { label: "No Next Step" },
  INCONSISTENT_FORECAST: { label: "Inconsistent Forecast" },
  LOW_ACTIVITY_HIGH_PIPELINE: { label: "Low Activity / High Pipeline" },
  STAGE_BOTTLENECK: { label: "Stage Bottleneck" },
  HIGH_VOLUME_LOW_CONVERSION: { label: "High Volume / Low Conversion" },
  HIGH_PROPOSALS_LOW_PROGRESS: { label: "High Proposals / Low Progress" },
};

// ─── Navigation Items ────────────────────────────────────────────────────────

const allRoles = Object.values(UserRole);
const allExceptViewer = allRoles.filter((r) => r !== UserRole.VIEWER);

export const NAV_SECTIONS = [
  {
    title: "Operation",
    items: [
      { label: "Home", href: "/", icon: "home", roles: allRoles },
      { label: "Inbox", href: "/inbox", icon: "inbox", roles: allRoles },
      { label: "Leads", href: "/leads", icon: "users", roles: [UserRole.SDR, UserRole.MANAGER, UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Opportunities", href: "/opportunities", icon: "briefcase", roles: [UserRole.CLOSER, UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Pipeline", href: "/pipeline", icon: "git-branch", roles: [UserRole.CLOSER, UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Tasks", href: "/tasks", icon: "check-square", roles: allRoles },
      { label: "Meetings", href: "/meetings", icon: "calendar", roles: allRoles },
    ],
  },
  {
    title: "Data",
    moduleKey: "data",
    items: [
      { label: "Overview", href: "/dashboards", icon: "pie-chart", roles: [UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Personas & Fit", href: "/data/personas", icon: "users", roles: allExceptViewer },
      { label: "Conversion by Stage", href: "/data/conversion", icon: "bar-chart", roles: allExceptViewer },
      { label: "Objections", href: "/data/objections", icon: "lightbulb", roles: allExceptViewer },
      { label: "Churn & Post-Sale", href: "/data/post-sale", icon: "trending-down", roles: allExceptViewer },
      { label: "Team Performance", href: "/data/team-performance", icon: "users", roles: [UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN] },
      { label: "Forecast & Revenue", href: "/forecast", icon: "trending-up", roles: [UserRole.CLOSER, UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN, UserRole.REVOPS] },
    ],
  },
  {
    title: "Reports",
    moduleKey: "reports",
    items: [
      { label: "Reports", href: "/reports", icon: "clipboard", roles: allExceptViewer },
    ],
  },
  {
    title: "Modules",
    items: [
      { label: "Commercial", href: "/modules/commercial", icon: "briefcase", roles: allExceptViewer, moduleKey: "commercial" },
      { label: "Post-Sale", href: "/modules/post-sale", icon: "heart", roles: allExceptViewer, moduleKey: "post_sale" },
      { label: "Consulting", href: "/modules/consulting", icon: "users", roles: allExceptViewer, moduleKey: "commercial" },
      { label: "Playbooks", href: "/playbooks", icon: "book-open", roles: [UserRole.SDR, UserRole.CLOSER, UserRole.MANAGER, UserRole.ADMIN, UserRole.REVOPS], moduleKey: "playbooks" },
      { label: "Automation", href: "/modules/automation", icon: "cpu", roles: [UserRole.ADMIN, UserRole.REVOPS], moduleKey: "automation" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Organization", href: "/settings/organization", icon: "building", roles: [UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Branding", href: "/settings/branding", icon: "settings", roles: [UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Users & Teams", href: "/team", icon: "users", roles: [UserRole.MANAGER, UserRole.DIRECTOR, UserRole.ADMIN] },
      { label: "Roles & Permissions", href: "/settings/roles", icon: "key", roles: [UserRole.ADMIN] },
      { label: "Integrations", href: "/integrations", icon: "plug", roles: [UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Pipelines & Stages", href: "/settings/pipelines", icon: "git-merge", roles: [UserRole.ADMIN, UserRole.REVOPS] },
      { label: "Audit", href: "/settings/audit", icon: "check-circle", roles: [UserRole.ADMIN] },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
