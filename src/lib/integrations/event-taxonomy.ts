/**
 * Canonical Event Taxonomy
 *
 * Every event that enters the Aexion Core system MUST map to one of these types.
 * This is the lingua franca between all providers and the core product.
 */

export interface EventTypeDefinition {
  key: string;
  domain: string;
  label: string;
  direction: "inbound" | "outbound" | "internal" | "system";
  channel: string;
  /** Whether this event should create an InboxMessage */
  createsInboxMessage: boolean;
  /** Whether this event should create an Activity */
  createsActivity: boolean;
  /** Whether this event should trigger alert evaluation */
  triggersAlerts: boolean;
}

export const EVENT_TAXONOMY: Record<string, EventTypeDefinition> = {
  // ── Email ─────────────────────────────────────────────────────────────────
  EMAIL_RECEIVED: {
    key: "EMAIL_RECEIVED",
    domain: "email",
    label: "Email Received",
    direction: "inbound",
    channel: "EMAIL",
    createsInboxMessage: true,
    createsActivity: true,
    triggersAlerts: true,
  },
  EMAIL_SENT: {
    key: "EMAIL_SENT",
    domain: "email",
    label: "Email Sent",
    direction: "outbound",
    channel: "EMAIL",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  EMAIL_BOUNCED: {
    key: "EMAIL_BOUNCED",
    domain: "email",
    label: "Email Bounced",
    direction: "system",
    channel: "EMAIL",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },
  EMAIL_REPLIED: {
    key: "EMAIL_REPLIED",
    domain: "email",
    label: "Email Reply Received",
    direction: "inbound",
    channel: "EMAIL",
    createsInboxMessage: true,
    createsActivity: true,
    triggersAlerts: true,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  MEETING_CREATED: {
    key: "MEETING_CREATED",
    domain: "calendar",
    label: "Meeting Created",
    direction: "internal",
    channel: "CALENDAR",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  MEETING_UPDATED: {
    key: "MEETING_UPDATED",
    domain: "calendar",
    label: "Meeting Updated",
    direction: "internal",
    channel: "CALENDAR",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  MEETING_CANCELED: {
    key: "MEETING_CANCELED",
    domain: "calendar",
    label: "Meeting Canceled",
    direction: "internal",
    channel: "CALENDAR",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },
  MEETING_COMPLETED: {
    key: "MEETING_COMPLETED",
    domain: "calendar",
    label: "Meeting Completed",
    direction: "internal",
    channel: "CALENDAR",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },

  // ── Telephony ─────────────────────────────────────────────────────────────
  CALL_STARTED: {
    key: "CALL_STARTED",
    domain: "telephony",
    label: "Call Started",
    direction: "outbound",
    channel: "CALL",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  CALL_ENDED: {
    key: "CALL_ENDED",
    domain: "telephony",
    label: "Call Ended",
    direction: "internal",
    channel: "CALL",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  CALL_MISSED: {
    key: "CALL_MISSED",
    domain: "telephony",
    label: "Missed Call",
    direction: "inbound",
    channel: "CALL",
    createsInboxMessage: true,
    createsActivity: true,
    triggersAlerts: true,
  },
  CALL_RECORDING_READY: {
    key: "CALL_RECORDING_READY",
    domain: "telephony",
    label: "Call Recording Ready",
    direction: "system",
    channel: "CALL",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },

  // ── Messaging ─────────────────────────────────────────────────────────────
  WHATSAPP_RECEIVED: {
    key: "WHATSAPP_RECEIVED",
    domain: "messaging",
    label: "WhatsApp Message Received",
    direction: "inbound",
    channel: "WHATSAPP",
    createsInboxMessage: true,
    createsActivity: true,
    triggersAlerts: true,
  },
  WHATSAPP_SENT: {
    key: "WHATSAPP_SENT",
    domain: "messaging",
    label: "WhatsApp Message Sent",
    direction: "outbound",
    channel: "WHATSAPP",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  WHATSAPP_DELIVERED: {
    key: "WHATSAPP_DELIVERED",
    domain: "messaging",
    label: "WhatsApp Delivered",
    direction: "system",
    channel: "WHATSAPP",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },
  WHATSAPP_READ: {
    key: "WHATSAPP_READ",
    domain: "messaging",
    label: "WhatsApp Read",
    direction: "system",
    channel: "WHATSAPP",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },
  SMS_RECEIVED: {
    key: "SMS_RECEIVED",
    domain: "messaging",
    label: "SMS Received",
    direction: "inbound",
    channel: "SMS",
    createsInboxMessage: true,
    createsActivity: true,
    triggersAlerts: true,
  },
  SMS_SENT: {
    key: "SMS_SENT",
    domain: "messaging",
    label: "SMS Sent",
    direction: "outbound",
    channel: "SMS",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  LEAD_CREATED_EXTERNAL: {
    key: "LEAD_CREATED_EXTERNAL",
    domain: "crm",
    label: "Lead Created (External)",
    direction: "inbound",
    channel: "CRM",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },
  CONTACT_UPDATED_EXTERNAL: {
    key: "CONTACT_UPDATED_EXTERNAL",
    domain: "crm",
    label: "Contact Updated (External)",
    direction: "inbound",
    channel: "CRM",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: false,
  },
  DEAL_STAGE_CHANGED_EXTERNAL: {
    key: "DEAL_STAGE_CHANGED_EXTERNAL",
    domain: "crm",
    label: "Deal Stage Changed (External)",
    direction: "inbound",
    channel: "CRM",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },

  // ── Collaboration ─────────────────────────────────────────────────────────
  SLACK_MESSAGE_RECEIVED: {
    key: "SLACK_MESSAGE_RECEIVED",
    domain: "collaboration",
    label: "Slack Message",
    direction: "inbound",
    channel: "SLACK",
    createsInboxMessage: true,
    createsActivity: false,
    triggersAlerts: false,
  },
  TEAMS_MESSAGE_RECEIVED: {
    key: "TEAMS_MESSAGE_RECEIVED",
    domain: "collaboration",
    label: "Teams Message",
    direction: "inbound",
    channel: "TEAMS",
    createsInboxMessage: true,
    createsActivity: false,
    triggersAlerts: false,
  },

  // ── System ────────────────────────────────────────────────────────────────
  INTEGRATION_CONNECTED: {
    key: "INTEGRATION_CONNECTED",
    domain: "system",
    label: "Integration Connected",
    direction: "system",
    channel: "SYSTEM",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },
  INTEGRATION_SYNC_SUCCEEDED: {
    key: "INTEGRATION_SYNC_SUCCEEDED",
    domain: "system",
    label: "Sync Succeeded",
    direction: "system",
    channel: "SYSTEM",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },
  INTEGRATION_SYNC_FAILED: {
    key: "INTEGRATION_SYNC_FAILED",
    domain: "system",
    label: "Sync Failed",
    direction: "system",
    channel: "SYSTEM",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: true,
  },
  WEBHOOK_REJECTED: {
    key: "WEBHOOK_REJECTED",
    domain: "system",
    label: "Webhook Rejected",
    direction: "system",
    channel: "SYSTEM",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: true,
  },
  TOKEN_EXPIRED: {
    key: "TOKEN_EXPIRED",
    domain: "system",
    label: "Token Expired",
    direction: "system",
    channel: "SYSTEM",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: true,
  },

  // ── Generic / Forms ───────────────────────────────────────────────────────
  FORM_SUBMITTED: {
    key: "FORM_SUBMITTED",
    domain: "forms",
    label: "Form Submitted",
    direction: "inbound",
    channel: "WEBHOOK",
    createsInboxMessage: false,
    createsActivity: true,
    triggersAlerts: true,
  },
  WEBHOOK_RECEIVED: {
    key: "WEBHOOK_RECEIVED",
    domain: "generic",
    label: "Webhook Received",
    direction: "inbound",
    channel: "WEBHOOK",
    createsInboxMessage: false,
    createsActivity: false,
    triggersAlerts: false,
  },
};
