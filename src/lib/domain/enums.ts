/**
 * Canonical domain enums — SINGLE SOURCE OF TRUTH
 *
 * All status, stage, type, and priority values used across
 * frontend, backend, and validation schemas must reference
 * these definitions. Never hardcode enum values elsewhere.
 */

// ─── Lead ─────────────────────────────────────────────────────────────────────

export const LEAD_STATUS = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  CONVERTED: "CONVERTED",
  DISQUALIFIED: "DISQUALIFIED",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_TEMPERATURE = {
  COLD: "COLD",
  COOL: "COOL",
  WARM: "WARM",
  HOT: "HOT",
} as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURE)[keyof typeof LEAD_TEMPERATURE];

/** Allowed transitions: defines which status can move to which */
export const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "DISQUALIFIED"],
  CONTACTED: ["QUALIFIED", "DISQUALIFIED"],
  QUALIFIED: ["CONVERTED", "DISQUALIFIED"],
  CONVERTED: [], // terminal
  DISQUALIFIED: ["NEW"], // can re-activate
};

// ─── Opportunity ──────────────────────────────────────────────────────────────

export const OPP_STAGE = {
  LEAD_INQUIRY: "LEAD_INQUIRY",
  PROPERTY_TOUR: "PROPERTY_TOUR",
  OFFER_SUBMITTED: "OFFER_SUBMITTED",
  UNDER_CONTRACT: "UNDER_CONTRACT",
  DUE_DILIGENCE: "DUE_DILIGENCE",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
} as const;

export type OppStage = (typeof OPP_STAGE)[keyof typeof OPP_STAGE];

/** Allowed stage transitions: forward movement or close */
export const OPP_STAGE_TRANSITIONS: Record<OppStage, OppStage[]> = {
  LEAD_INQUIRY: ["PROPERTY_TOUR", "OFFER_SUBMITTED", "UNDER_CONTRACT", "DUE_DILIGENCE", "CLOSED_WON", "CLOSED_LOST"],
  PROPERTY_TOUR: ["LEAD_INQUIRY", "OFFER_SUBMITTED", "UNDER_CONTRACT", "DUE_DILIGENCE", "CLOSED_WON", "CLOSED_LOST"],
  OFFER_SUBMITTED: ["LEAD_INQUIRY", "PROPERTY_TOUR", "UNDER_CONTRACT", "DUE_DILIGENCE", "CLOSED_WON", "CLOSED_LOST"],
  UNDER_CONTRACT: ["LEAD_INQUIRY", "PROPERTY_TOUR", "OFFER_SUBMITTED", "DUE_DILIGENCE", "CLOSED_WON", "CLOSED_LOST"],
  DUE_DILIGENCE: ["LEAD_INQUIRY", "PROPERTY_TOUR", "OFFER_SUBMITTED", "UNDER_CONTRACT", "CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON: ["LEAD_INQUIRY"], // can re-open
  CLOSED_LOST: ["LEAD_INQUIRY"], // can re-open
};

/** Default probability by stage */
export const STAGE_DEFAULT_PROBABILITY: Record<OppStage, number> = {
  LEAD_INQUIRY: 10,
  PROPERTY_TOUR: 25,
  OFFER_SUBMITTED: 50,
  UNDER_CONTRACT: 70,
  DUE_DILIGENCE: 85,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

// ─── Task ─────────────────────────────────────────────────────────────────────

export const TASK_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_TYPE = {
  FOLLOW_UP: "FOLLOW_UP",
  CALL: "CALL",
  EMAIL: "EMAIL",
  MEETING: "MEETING",
  APPROVAL: "APPROVAL",
  OTHER: "OTHER",
} as const;

export const TASK_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

// ─── Activity ─────────────────────────────────────────────────────────────────

export const ACTIVITY_TYPE = {
  // User-created
  MESSAGE: "MESSAGE",
  EMAIL: "EMAIL",
  CALL: "CALL",
  MEETING: "MEETING",
  NOTE: "NOTE",
  WHATSAPP: "WHATSAPP",
  // System-generated
  STAGE_CHANGE: "STAGE_CHANGE",
  TASK_COMPLETED: "TASK_COMPLETED",
  FILE_SHARED: "FILE_SHARED",
  // Domain events (canonical dot-notation)
  LEAD_CONVERTED: "lead.converted",
  LEAD_CREATED: "lead.created",
  LEAD_STATUS_CHANGED: "lead.status_changed",
  OPP_CREATED: "opportunity.created",
  OPP_STAGE_CHANGED: "opportunity.stage_changed",
  TASK_CREATED: "task.created",
  TASK_DONE: "task.completed",
} as const;

export const ACTIVITY_CHANNEL = {
  EMAIL: "email",
  PHONE: "phone",
  WHATSAPP: "whatsapp",
  VIDEO: "video",
  LINKEDIN: "linkedin",
  IN_PERSON: "in_person",
  INTERNAL: "internal",
  SYSTEM: "system",
} as const;
