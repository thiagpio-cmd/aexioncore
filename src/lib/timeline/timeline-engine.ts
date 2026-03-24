import { prisma } from "@/lib/db";

// ============================================================================
// Timeline Event Types
// ============================================================================

export type TimelineEventType =
  // Communication
  | "EMAIL_RECEIVED" | "EMAIL_SENT" | "WHATSAPP_RECEIVED" | "WHATSAPP_SENT"
  | "CALL_MADE" | "CALL_RECEIVED" | "SMS_SENT" | "SMS_RECEIVED"
  // Activity
  | "NOTE_ADDED" | "ACTIVITY_LOGGED" | "DOCUMENT_SHARED"
  // Milestones
  | "LEAD_CREATED" | "LEAD_CONVERTED" | "STAGE_CHANGED" | "DEAL_WON" | "DEAL_LOST"
  | "CONTACT_CREATED" | "ACCOUNT_CREATED"
  // Tasks
  | "TASK_CREATED" | "TASK_COMPLETED" | "TASK_OVERDUE"
  // Meetings
  | "MEETING_SCHEDULED" | "MEETING_COMPLETED" | "MEETING_CANCELED"
  // System
  | "INTEGRATION_SYNCED" | "ALERT_TRIGGERED" | "RECOMMENDATION_GENERATED"
  | "PLAYBOOK_APPLIED" | "OWNER_CHANGED" | "ASSIGNMENT_CHANGED";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  category: "communication" | "activity" | "system" | "milestone" | "task" | "meeting" | "alert";
  actor: { id: string; name: string; type: "user" | "system" | "integration" };
  subject: string;
  detail?: string;
  entityType: string;
  entityId: string;
  source: "manual" | "integration" | "system" | "automation";
  sourceProvider?: string;
  sourceExternalId?: string;
  direction?: "inbound" | "outbound";
  channel?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
}

export interface TimelineQuery {
  entityType?: string;
  entityId?: string;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
  organizationId?: string;
  types?: TimelineEventType[];
  categories?: TimelineEvent["category"][];
  channels?: string[];
  sources?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Activity type → TimelineEventType mapping
// ============================================================================

const ACTIVITY_TYPE_MAP: Record<string, { type: TimelineEventType; category: TimelineEvent["category"] }> = {
  EMAIL: { type: "EMAIL_SENT", category: "communication" },
  EMAIL_RECEIVED: { type: "EMAIL_RECEIVED", category: "communication" },
  EMAIL_SENT: { type: "EMAIL_SENT", category: "communication" },
  CALL: { type: "CALL_MADE", category: "communication" },
  CALL_MADE: { type: "CALL_MADE", category: "communication" },
  CALL_RECEIVED: { type: "CALL_RECEIVED", category: "communication" },
  WHATSAPP: { type: "WHATSAPP_SENT", category: "communication" },
  WHATSAPP_SENT: { type: "WHATSAPP_SENT", category: "communication" },
  WHATSAPP_RECEIVED: { type: "WHATSAPP_RECEIVED", category: "communication" },
  SMS: { type: "SMS_SENT", category: "communication" },
  SMS_SENT: { type: "SMS_SENT", category: "communication" },
  SMS_RECEIVED: { type: "SMS_RECEIVED", category: "communication" },
  NOTE: { type: "NOTE_ADDED", category: "activity" },
  MEETING: { type: "MEETING_SCHEDULED", category: "meeting" },
  STAGE_CHANGE: { type: "STAGE_CHANGED", category: "milestone" },
  STATUS_CHANGE: { type: "STAGE_CHANGED", category: "milestone" },
  LEAD_CREATED: { type: "LEAD_CREATED", category: "milestone" },
  LEAD_CONVERTED: { type: "LEAD_CONVERTED", category: "milestone" },
  DEAL_WON: { type: "DEAL_WON", category: "milestone" },
  DEAL_LOST: { type: "DEAL_LOST", category: "milestone" },
  DOCUMENT_SHARED: { type: "DOCUMENT_SHARED", category: "activity" },
  // Canonical dot-notation events
  "lead.created": { type: "LEAD_CREATED", category: "milestone" },
  "lead.converted": { type: "LEAD_CONVERTED", category: "milestone" },
  "opportunity.created": { type: "ACTIVITY_LOGGED", category: "milestone" },
  "opportunity.stage_changed": { type: "STAGE_CHANGED", category: "milestone" },
  "task.created": { type: "TASK_CREATED", category: "task" },
  "message.action_created": { type: "ACTIVITY_LOGGED", category: "activity" },
  "message.classified": { type: "ACTIVITY_LOGGED", category: "activity" },
  "message.linked": { type: "ACTIVITY_LOGGED", category: "activity" },
  "contact.linked": { type: "ACTIVITY_LOGGED", category: "activity" },
  "opportunity.linked": { type: "ACTIVITY_LOGGED", category: "activity" },
  "message.archived": { type: "ACTIVITY_LOGGED", category: "activity" },
  "message.reply_sent": { type: "EMAIL_SENT", category: "communication" },
  "message.snoozed": { type: "ACTIVITY_LOGGED", category: "activity" },
  "integration.connected": { type: "INTEGRATION_SYNCED", category: "system" },
};

// Channel mapping from inbox message channel field
const INBOX_CHANNEL_MAP: Record<string, { type: TimelineEventType; direction: "inbound" | "outbound" }> = {
  EMAIL: { type: "EMAIL_RECEIVED", direction: "inbound" },
  WHATSAPP: { type: "WHATSAPP_RECEIVED", direction: "inbound" },
  SMS: { type: "SMS_RECEIVED", direction: "inbound" },
  CALL: { type: "CALL_RECEIVED", direction: "inbound" },
};

// ============================================================================
// TimelineEngine
// ============================================================================

export class TimelineEngine {
  /**
   * Build a unified timeline by querying multiple sources and merging them chronologically.
   * Hybrid approach: some events are materialized (Activity, InboxMessage, WebhookEvent),
   * others are derived at runtime (Tasks, Meetings).
   */
  async getTimeline(query: TimelineQuery): Promise<{ events: TimelineEvent[]; total: number }> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Build entity filter conditions for each source table
    const entityFilters = this.buildEntityFilters(query);

    // Run all queries in parallel
    const [activities, inboxMessages, tasks, meetings, webhookEvents] = await Promise.all([
      this.queryActivities(entityFilters, query),
      this.queryInboxMessages(entityFilters, query),
      this.queryTasks(entityFilters, query),
      this.queryMeetings(entityFilters, query),
      this.queryWebhookEvents(entityFilters, query),
    ]);

    // Convert each source to TimelineEvent[]
    let allEvents: TimelineEvent[] = [];

    for (const activity of activities) {
      allEvents.push(this.activityToTimelineEvent(activity, query));
    }

    for (const message of inboxMessages) {
      allEvents.push(this.inboxMessageToTimelineEvent(message, query));
    }

    for (const task of tasks) {
      allEvents.push(...this.taskToTimelineEvents(task, query));
    }

    for (const meeting of meetings) {
      allEvents.push(this.meetingToTimelineEvent(meeting, query));
    }

    for (const event of webhookEvents) {
      allEvents.push(this.webhookEventToTimelineEvent(event, query));
    }

    // Deduplicate integration-sourced events (same email appears as both Activity and InboxMessage).
    // InboxMessage has richer data (sender, subject, body, entity links), so prefer it over Activity.
    // Only deduplicate events that have a sourceExternalId from an integration provider.
    allEvents = this.deduplicateIntegrationEvents(allEvents);

    // Apply type/category/channel/source filters
    allEvents = this.applyPostFilters(allEvents, query);

    // Sort by occurredAt DESC
    allEvents.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const total = allEvents.length;

    // Apply pagination
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    return { events: paginatedEvents, total };
  }

  // ==========================================================================
  // Entity filter builder
  // ==========================================================================

  private buildEntityFilters(query: TimelineQuery): EntityFilters {
    return {
      entityType: query.entityType,
      entityId: query.entityId,
      contactId: query.contactId,
      companyId: query.companyId,
      ownerId: query.ownerId,
      organizationId: query.organizationId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
  }

  // ==========================================================================
  // Source queries
  // ==========================================================================

  private async queryActivities(filters: EntityFilters, _query: TimelineQuery): Promise<ActivityRecord[]> {
    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;

    if (filters.entityType === "lead" && filters.entityId) {
      where.leadId = filters.entityId;
    } else if (filters.entityType === "opportunity" && filters.entityId) {
      where.opportunityId = filters.entityId;
    } else if (filters.entityId) {
      // Generic: try both
      where.OR = [{ leadId: filters.entityId }, { opportunityId: filters.entityId }];
    }

    if (filters.ownerId) {
      where.creatorId = filters.ownerId;
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      where.createdAt = dateFilter;
    }

    return prisma.activity.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200, // reasonable cap per source
    }) as Promise<ActivityRecord[]>;
  }

  private async queryInboxMessages(filters: EntityFilters, _query: TimelineQuery): Promise<InboxMessageRecord[]> {
    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;

    if (filters.entityType === "lead" && filters.entityId) {
      where.leadId = filters.entityId;
    } else if (filters.entityType === "opportunity" && filters.entityId) {
      where.opportunityId = filters.entityId;
    } else if (filters.entityType === "contact" && filters.entityId) {
      where.contactId = filters.entityId;
    } else if (filters.entityType === "account" && filters.entityId) {
      where.companyId = filters.entityId;
    } else if (filters.entityId) {
      where.OR = [
        { leadId: filters.entityId },
        { opportunityId: filters.entityId },
        { contactId: filters.entityId },
        { companyId: filters.entityId },
      ];
    }

    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.ownerId) where.ownerId = filters.ownerId;

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      where.createdAt = dateFilter;
    }

    return prisma.inboxMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }) as Promise<InboxMessageRecord[]>;
  }

  private async queryTasks(filters: EntityFilters, _query: TimelineQuery): Promise<TaskRecord[]> {
    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;

    if (filters.entityType === "lead" && filters.entityId) {
      where.leadId = filters.entityId;
    } else if (filters.entityType === "opportunity" && filters.entityId) {
      where.opportunityId = filters.entityId;
    } else if (filters.entityId) {
      where.OR = [{ leadId: filters.entityId }, { opportunityId: filters.entityId }];
    }

    if (filters.ownerId) where.ownerId = filters.ownerId;

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      where.createdAt = dateFilter;
    }

    return prisma.task.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }) as Promise<TaskRecord[]>;
  }

  private async queryMeetings(filters: EntityFilters, _query: TimelineQuery): Promise<MeetingRecord[]> {
    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;

    if (filters.entityType === "lead" && filters.entityId) {
      where.leadId = filters.entityId;
    } else if (filters.entityType === "contact" && filters.entityId) {
      where.contactId = filters.entityId;
    } else if (filters.entityId) {
      where.OR = [{ leadId: filters.entityId }, { contactId: filters.entityId }];
    }

    if (filters.ownerId) where.ownerId = filters.ownerId;

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      where.startTime = dateFilter;
    }

    return prisma.meeting.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "desc" },
      take: 200,
    }) as Promise<MeetingRecord[]>;
  }

  private async queryWebhookEvents(filters: EntityFilters, _query: TimelineQuery): Promise<WebhookEventRecord[]> {
    // WebhookEvents don't have direct entity links, so we only query if no specific entity filter
    // or we query all and let post-filtering handle it. For efficiency, skip if entity-specific.
    if (filters.entityId) return [];

    const where: any = {
      status: "processed",
    };
    if (filters.organizationId) {
      where.integration = { organizationId: filters.organizationId };
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.lte = filters.dateTo;
      where.createdAt = dateFilter;
    }

    return prisma.webhookEvent.findMany({
      where,
      include: { integration: { select: { name: true, providerKey: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }) as Promise<WebhookEventRecord[]>;
  }

  // ==========================================================================
  // Converters
  // ==========================================================================

  private activityToTimelineEvent(activity: ActivityRecord, query: TimelineQuery): TimelineEvent {
    const mapped = ACTIVITY_TYPE_MAP[activity.type] || { type: "ACTIVITY_LOGGED" as TimelineEventType, category: "activity" as const };

    const channelLower = (activity.channel || "internal").toLowerCase();
    let direction: "inbound" | "outbound" | undefined;
    if (mapped.type.includes("RECEIVED")) direction = "inbound";
    else if (mapped.type.includes("SENT") || mapped.type.includes("MADE")) direction = "outbound";

    return {
      id: `activity-${activity.id}`,
      type: mapped.type,
      category: mapped.category,
      actor: {
        id: activity.creator?.id || activity.creatorId,
        name: activity.creator?.name || "Unknown",
        type: "user",
      },
      subject: activity.subject || `${activity.type.replace(/_/g, " ").toLowerCase()} logged`,
      detail: activity.body || undefined,
      entityType: query.entityType || (activity.leadId ? "lead" : activity.opportunityId ? "opportunity" : "unknown"),
      entityId: query.entityId || activity.leadId || activity.opportunityId || "",
      source: activity.revenueEventId ? "integration" : "manual",
      sourceProvider: activity.sourceSystem || undefined,
      sourceExternalId: activity.externalId || undefined,
      channel: channelLower,
      direction,
      occurredAt: new Date(activity.createdAt),
      createdAt: new Date(activity.createdAt),
    };
  }

  private inboxMessageToTimelineEvent(message: InboxMessageRecord, query: TimelineQuery): TimelineEvent {
    const channelUpper = (message.channel || "EMAIL").toUpperCase();
    const mapped = INBOX_CHANNEL_MAP[channelUpper] || { type: "EMAIL_RECEIVED" as TimelineEventType, direction: "inbound" as const };

    return {
      id: `inbox-${message.id}`,
      type: mapped.type,
      category: "communication",
      actor: {
        id: message.contactId || "external",
        name: message.sender || "External",
        type: message.sourceSystem ? "integration" : "user",
      },
      subject: message.subject || `${channelUpper.toLowerCase()} message from ${message.sender}`,
      detail: message.body ? message.body.substring(0, 200) : undefined,
      entityType: query.entityType || (message.leadId ? "lead" : message.opportunityId ? "opportunity" : "contact"),
      entityId: query.entityId || message.leadId || message.opportunityId || message.contactId || "",
      source: message.sourceSystem ? "integration" : "manual",
      sourceProvider: message.sourceSystem || undefined,
      sourceExternalId: message.sourceExternalId || undefined,
      direction: mapped.direction,
      channel: channelUpper.toLowerCase(),
      occurredAt: new Date(message.createdAt),
      createdAt: new Date(message.createdAt),
    };
  }

  private taskToTimelineEvents(task: TaskRecord, query: TimelineQuery): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const entityType = query.entityType || (task.leadId ? "lead" : task.opportunityId ? "opportunity" : "unknown");
    const entityId = query.entityId || task.leadId || task.opportunityId || "";

    const actor = {
      id: task.owner?.id || task.ownerId,
      name: task.owner?.name || "Unknown",
      type: "user" as const,
    };

    // TASK_CREATED event
    events.push({
      id: `task-created-${task.id}`,
      type: "TASK_CREATED",
      category: "task",
      actor,
      subject: `Task created: ${task.title}`,
      detail: task.description || undefined,
      entityType,
      entityId,
      source: "manual",
      channel: "internal",
      metadata: { taskId: task.id, priority: task.priority, status: task.status },
      occurredAt: new Date(task.createdAt),
      createdAt: new Date(task.createdAt),
    });

    // TASK_COMPLETED event (if completed)
    if (task.status === "COMPLETED" && task.completedAt) {
      events.push({
        id: `task-completed-${task.id}`,
        type: "TASK_COMPLETED",
        category: "task",
        actor,
        subject: `Task completed: ${task.title}`,
        entityType,
        entityId,
        source: "manual",
        channel: "internal",
        metadata: { taskId: task.id },
        occurredAt: new Date(task.completedAt),
        createdAt: new Date(task.completedAt),
      });
    }

    // TASK_OVERDUE event (if past due and not completed)
    if (task.dueDate && task.status !== "COMPLETED" && new Date(task.dueDate) < new Date()) {
      events.push({
        id: `task-overdue-${task.id}`,
        type: "TASK_OVERDUE",
        category: "alert",
        actor: { id: "system", name: "System", type: "system" },
        subject: `Task overdue: ${task.title}`,
        entityType,
        entityId,
        source: "system",
        channel: "internal",
        metadata: { taskId: task.id, dueDate: task.dueDate },
        occurredAt: new Date(task.dueDate),
        createdAt: new Date(task.dueDate),
      });
    }

    return events;
  }

  private meetingToTimelineEvent(meeting: MeetingRecord, query: TimelineQuery): TimelineEvent {
    const now = new Date();
    const startTime = new Date(meeting.startTime);
    const isPast = startTime < now;

    let type: TimelineEventType = "MEETING_SCHEDULED";
    if (isPast) type = "MEETING_COMPLETED";

    return {
      id: `meeting-${meeting.id}`,
      type,
      category: "meeting",
      actor: {
        id: meeting.owner?.id || meeting.ownerId,
        name: meeting.owner?.name || "Unknown",
        type: "user",
      },
      subject: meeting.title,
      detail: meeting.description || undefined,
      entityType: query.entityType || (meeting.leadId ? "lead" : "contact"),
      entityId: query.entityId || meeting.leadId || meeting.contactId || "",
      source: meeting.sourceSystem ? "integration" : "manual",
      sourceProvider: meeting.sourceSystem || undefined,
      channel: "calendar",
      metadata: {
        meetingId: meeting.id,
        location: meeting.location,
        contactName: meeting.contact?.name,
      },
      occurredAt: startTime,
      createdAt: new Date(meeting.createdAt),
    };
  }

  private webhookEventToTimelineEvent(event: WebhookEventRecord, _query: TimelineQuery): TimelineEvent {
    return {
      id: `webhook-${event.id}`,
      type: "INTEGRATION_SYNCED",
      category: "system",
      actor: {
        id: event.integrationId,
        name: event.integration?.name || "Integration",
        type: "integration",
      },
      subject: `${event.integration?.name || "Integration"}: ${event.eventType.replace(/_/g, " ").toLowerCase()}`,
      entityType: "system",
      entityId: event.integrationId,
      source: "integration",
      sourceProvider: event.integration?.providerKey || undefined,
      channel: "system",
      metadata: {
        webhookEventId: event.id,
        eventType: event.eventType,
        status: event.status,
      },
      occurredAt: new Date(event.createdAt),
      createdAt: new Date(event.createdAt),
    };
  }

  // ==========================================================================
  // Deduplication (integration-sourced events)
  // ==========================================================================

  /**
   * When Gmail (or other integrations) sync an email, the inbox-ingestion-service
   * creates both an InboxMessage and an Activity for the same email. This method
   * deduplicates by sourceExternalId+sourceProvider, keeping the InboxMessage
   * version (prefixed with "inbox-") which has richer data.
   *
   * Manual activities (no sourceExternalId/sourceProvider) are never deduplicated.
   */
  private deduplicateIntegrationEvents(events: TimelineEvent[]): TimelineEvent[] {
    const seen = new Map<string, TimelineEvent>();
    const result: TimelineEvent[] = [];

    for (const event of events) {
      // Non-integration events (no sourceExternalId or no sourceProvider) are always kept
      if (!event.sourceExternalId || !event.sourceProvider) {
        result.push(event);
        continue;
      }

      const key = `${event.sourceProvider}:${event.sourceExternalId}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, event);
        result.push(event);
        continue;
      }

      // If we already have an InboxMessage version, skip this duplicate
      if (existing.id.startsWith("inbox-")) {
        continue;
      }

      // If the new event is an InboxMessage, replace the existing (Activity) version
      if (event.id.startsWith("inbox-")) {
        const idx = result.indexOf(existing);
        if (idx !== -1) {
          result[idx] = event;
        }
        seen.set(key, event);
        continue;
      }

      // Both are non-inbox (e.g., two activities) — skip the duplicate
      continue;
    }

    return result;
  }

  // ==========================================================================
  // Post-filters (applied after merge, before pagination)
  // ==========================================================================

  private applyPostFilters(events: TimelineEvent[], query: TimelineQuery): TimelineEvent[] {
    let filtered = events;

    if (query.types && query.types.length > 0) {
      const typeSet = new Set(query.types);
      filtered = filtered.filter((e) => typeSet.has(e.type));
    }

    if (query.categories && query.categories.length > 0) {
      const catSet = new Set(query.categories);
      filtered = filtered.filter((e) => catSet.has(e.category));
    }

    if (query.channels && query.channels.length > 0) {
      const channelSet = new Set(query.channels.map((c) => c.toLowerCase()));
      filtered = filtered.filter((e) => e.channel && channelSet.has(e.channel.toLowerCase()));
    }

    if (query.sources && query.sources.length > 0) {
      const sourceSet = new Set(query.sources);
      filtered = filtered.filter((e) => sourceSet.has(e.source));
    }

    return filtered;
  }
}

// ============================================================================
// Internal types for query results
// ============================================================================

interface EntityFilters {
  entityType?: string;
  entityId?: string;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
  organizationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface ActivityRecord {
  id: string;
  type: string;
  channel: string | null;
  subject: string | null;
  body: string | null;
  creatorId: string;
  creator?: { id: string; name: string } | null;
  leadId: string | null;
  opportunityId: string | null;
  revenueEventId: string | null;
  externalId: string | null;
  sourceSystem: string | null;
  createdAt: Date;
}

interface InboxMessageRecord {
  id: string;
  channel: string;
  sender: string;
  subject: string | null;
  body: string;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  ownerId: string | null;
  sourceSystem: string | null;
  sourceExternalId: string | null;
  createdAt: Date;
}

interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  leadId: string | null;
  opportunityId: string | null;
  ownerId: string;
  owner?: { id: string; name: string } | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface MeetingRecord {
  id: string;
  title: string;
  description: string | null;
  leadId: string | null;
  contactId: string | null;
  ownerId: string;
  owner?: { id: string; name: string } | null;
  contact?: { id: string; name: string } | null;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  sourceSystem: string | null;
  createdAt: Date;
}

interface WebhookEventRecord {
  id: string;
  integrationId: string;
  eventType: string;
  status: string;
  integration?: { name: string; providerKey: string | null } | null;
  createdAt: Date;
}

// Singleton instance
export const timelineEngine = new TimelineEngine();
