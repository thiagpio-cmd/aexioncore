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
  PROSPECTING: "PROSPECTING",
  INITIAL_CONTACT: "INITIAL_CONTACT",
  PROPERTY_TOUR: "PROPERTY_TOUR",
  LOI_SUBMITTED: "LOI_SUBMITTED",
  LOI_NEGOTIATION: "LOI_NEGOTIATION",
  UNDER_CONTRACT: "UNDER_CONTRACT",
  DUE_DILIGENCE: "DUE_DILIGENCE",
  FINANCING: "FINANCING",
  CLOSING: "CLOSING",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
} as const;

export type OppStage = (typeof OPP_STAGE)[keyof typeof OPP_STAGE];

/** Allowed stage transitions: any active stage can move forward/backward or close */
export const OPP_STAGE_TRANSITIONS: Record<OppStage, OppStage[]> = {
  PROSPECTING: ["INITIAL_CONTACT", "PROPERTY_TOUR", "CLOSED_LOST"],
  INITIAL_CONTACT: ["PROSPECTING", "PROPERTY_TOUR", "LOI_SUBMITTED", "CLOSED_LOST"],
  PROPERTY_TOUR: ["INITIAL_CONTACT", "LOI_SUBMITTED", "LOI_NEGOTIATION", "CLOSED_LOST"],
  LOI_SUBMITTED: ["PROPERTY_TOUR", "LOI_NEGOTIATION", "UNDER_CONTRACT", "CLOSED_LOST"],
  LOI_NEGOTIATION: ["LOI_SUBMITTED", "UNDER_CONTRACT", "CLOSED_LOST"],
  UNDER_CONTRACT: ["LOI_NEGOTIATION", "DUE_DILIGENCE", "CLOSED_LOST"],
  DUE_DILIGENCE: ["UNDER_CONTRACT", "FINANCING", "CLOSING", "CLOSED_LOST"],
  FINANCING: ["DUE_DILIGENCE", "CLOSING", "CLOSED_LOST"],
  CLOSING: ["FINANCING", "DUE_DILIGENCE", "CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON: ["PROSPECTING"], // can re-open
  CLOSED_LOST: ["PROSPECTING"], // can re-open
};

/** Default probability by stage — CRE deal lifecycle */
export const STAGE_DEFAULT_PROBABILITY: Record<OppStage, number> = {
  PROSPECTING: 5,
  INITIAL_CONTACT: 10,
  PROPERTY_TOUR: 20,
  LOI_SUBMITTED: 35,
  LOI_NEGOTIATION: 50,
  UNDER_CONTRACT: 65,
  DUE_DILIGENCE: 75,
  FINANCING: 85,
  CLOSING: 95,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

// ─── CRE Property Types ─────────────────────────────────────────────────────

export const PROPERTY_TYPE = {
  OFFICE: "OFFICE",
  RETAIL: "RETAIL",
  INDUSTRIAL: "INDUSTRIAL",
  MULTIFAMILY: "MULTIFAMILY",
  MIXED_USE: "MIXED_USE",
  LAND: "LAND",
  HOSPITALITY: "HOSPITALITY",
  MEDICAL_OFFICE: "MEDICAL_OFFICE",
  SELF_STORAGE: "SELF_STORAGE",
} as const;

export type PropertyType = (typeof PROPERTY_TYPE)[keyof typeof PROPERTY_TYPE];

export const DEAL_TYPE = {
  SALE: "SALE",
  LEASE: "LEASE",
  SUBLEASE: "SUBLEASE",
  GROUND_LEASE: "GROUND_LEASE",
  SALE_LEASEBACK: "SALE_LEASEBACK",
} as const;

export type DealType = (typeof DEAL_TYPE)[keyof typeof DEAL_TYPE];

export const DOCUMENT_TYPE = {
  LOI: "LOI",
  PSA: "PSA",
  NDA: "NDA",
  LEASE: "LEASE",
  AMENDMENT: "AMENDMENT",
  CA: "CA",
  ESTOPPEL: "ESTOPPEL",
  SURVEY: "SURVEY",
  ENVIRONMENTAL: "ENVIRONMENTAL",
  TITLE: "TITLE",
  FINANCIAL: "FINANCIAL",
} as const;

export const COMMISSION_ROLE = {
  LISTING_AGENT: "LISTING_AGENT",
  BUYERS_AGENT: "BUYERS_AGENT",
  REFERRAL: "REFERRAL",
  COOP_BROKER: "COOP_BROKER",
} as const;

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
