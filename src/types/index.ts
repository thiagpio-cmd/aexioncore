// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  SDR = "SDR",
  CLOSER = "CLOSER",
  MANAGER = "MANAGER",
  DIRECTOR = "DIRECTOR",
  ADMIN = "ADMIN",
  REVOPS = "REVOPS",
  VIEWER = "VIEWER",
}

export enum WorkspaceType {
  SDR = "SDR",
  CLOSER = "CLOSER",
  MANAGER = "MANAGER",
  EXECUTIVE = "EXECUTIVE",
}

// ─── Core Entities ───────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  teamId: string;
  organizationId: string;
  createdAt?: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  managerId: string;
  organizationId: string;
  members: User[];
};

// ─── Lead ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "UNQUALIFIED"
  | "CONVERTED";

export type LeadTemperature = "COLD" | "WARM" | "HOT";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  source: string;
  status: LeadStatus;
  fitScore: number;
  temperature: LeadTemperature;
  ownerId: string;
  owner?: User;
  companyId: string;
  pain: string;
  objections: string[];
  lastContactedAt: string;
  nextFollowUpAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  confidence: number;
  provenance: string;
};

// ─── Account ─────────────────────────────────────────────────────────────────

export type Account = {
  id: string;
  name: string;
  industry: string;
  website: string;
  size: string;
  annualRevenue: number;
  companyId: string;
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
};

// ─── Opportunity ─────────────────────────────────────────────────────────────

export type Opportunity = {
  id: string;
  title: string;
  accountId: string;
  accountName: string;
  value: number;
  stage: string;
  probability: number;
  ownerId: string;
  ownerName: string;
  healthScore: number;
  closeDate: string;
  competitors: string[];
  champion: string;
  decisionMaker: string;
  nextStep: string;
  risks: string[];
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
  daysInStage: number;
};

// ─── Task ────────────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  ownerId: string;
  relatedType: string;
  relatedId: string;
  relatedName: string;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  description: string;
};

// ─── Activity ────────────────────────────────────────────────────────────────

export type Activity = {
  id: string;
  type: string;
  summary: string;
  userId: string;
  userName: string;
  relatedType: string;
  relatedId: string;
  relatedName: string;
  createdAt: string;
  source: string;
  confidence: number;
  tags: string[];
};

// ─── Insight ─────────────────────────────────────────────────────────────────

export type Insight = {
  id: string;
  title: string;
  description: string;
  impact: string;
  action: string;
  confidence: number;
  source: string;
  relatedType: string;
  relatedId: string;
  relatedName: string;
  category: string;
  createdAt: string;
};

// ─── Meeting ─────────────────────────────────────────────────────────────────

export type Meeting = {
  id: string;
  title: string;
  type: string;
  date: string;
  duration: number;
  attendees: string[];
  ownerId: string;
  relatedType: string;
  relatedId: string;
  relatedName: string;
  status: string;
  notes: string;
  location: string;
};

// ─── Inbox ───────────────────────────────────────────────────────────────────

export type InboxMessage = {
  id: string;
  channel: string;
  from: string;
  fromCompany: string;
  subject: string;
  preview: string;
  relatedType: string;
  relatedId: string;
  ownerId: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
  threadId: string;
};

// ─── Integration ─────────────────────────────────────────────────────────────

export type Integration = {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: string;
  lastSync: string;
  eventsReceived: number;
  eventsSent: number;
  health: number;
  scopes: string[];
  fieldMappings: number;
};

// ─── Playbook ────────────────────────────────────────────────────────────────

export type Playbook = {
  id: string;
  title: string;
  category: string;
  stage: string;
  segment: string;
  description: string;
  steps: number;
  avgConversion: number;
  usageCount: number;
  updatedAt: string;
};

// ─── Forecast ────────────────────────────────────────────────────────────────

export type ForecastSnapshot = {
  id: string;
  userId: string;
  userName: string;
  period: string;
  commit: number;
  bestCase: number;
  pipeline: number;
  closed: number;
  target: number;
  accuracy: number;
  updatedAt: string;
};

// ─── Audit & Webhooks ────────────────────────────────────────────────────────

export type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  object: string;
  objectId: string;
  objectName: string;
  details: string;
  source: string;
  createdAt: string;
};

export type WebhookEvent = {
  id: string;
  type: string;
  connector: string;
  status: string;
  payload: string;
  objectType: string;
  objectId: string | null;
  createdAt: string;
  processedAt: string | null;
  retries: number;
};

// ─── Navigation ──────────────────────────────────────────────────────────────

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
  badge?: number;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};
