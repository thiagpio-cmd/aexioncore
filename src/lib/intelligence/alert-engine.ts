import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertType =
  | "STALE_LEAD"
  | "OVERDUE_TASK"
  | "STUCK_DEAL"
  | "AT_RISK_DEAL"
  | "NO_NEXT_STEP"
  | "HIGH_VALUE_NO_MEETING"
  | "UPCOMING_DEADLINE"
  | "FORECAST_GAP"
  | "PIPELINE_COVERAGE_LOW"
  | "INACTIVE_ACCOUNT"
  | "INTEGRATION_DEGRADED"
  | "TOKEN_EXPIRING"
  | "CONVERSION_OVERDUE"
  | "MEETING_NO_FOLLOWUP"
  | "DEAL_AGING";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  reasoning: string;
  entityType: string;
  entityId: string;
  entityName: string;
  ownerId?: string;
  ownerName?: string;
  actionLabel: string;
  actionUrl: string;
  triggerValue: number;
  threshold: number;
  createdAt: Date;
  acknowledgedAt?: Date;
}

export interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  threshold: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Default rule configurations
// ---------------------------------------------------------------------------

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { type: "STALE_LEAD", severity: "warning", enabled: true, threshold: 5, description: "Lead without activity for X days" },
  { type: "OVERDUE_TASK", severity: "critical", enabled: true, threshold: 0, description: "Task past due date" },
  { type: "STUCK_DEAL", severity: "warning", enabled: true, threshold: 14, description: "Deal in same stage for X days" },
  { type: "AT_RISK_DEAL", severity: "critical", enabled: true, threshold: 21, description: "High-value deal without activity for X days" },
  { type: "NO_NEXT_STEP", severity: "warning", enabled: true, threshold: 0, description: "Open deal without scheduled next step" },
  { type: "HIGH_VALUE_NO_MEETING", severity: "warning", enabled: true, threshold: 50000, description: "Deal over $X without any meeting" },
  { type: "FORECAST_GAP", severity: "critical", enabled: true, threshold: 20, description: "Forecast gap exceeds X% of target" },
  { type: "PIPELINE_COVERAGE_LOW", severity: "warning", enabled: true, threshold: 3, description: "Pipeline coverage below Xx target" },
  { type: "CONVERSION_OVERDUE", severity: "info", enabled: true, threshold: 10, description: "HOT lead not converted in X days" },
  { type: "MEETING_NO_FOLLOWUP", severity: "warning", enabled: true, threshold: 2, description: "Meeting completed X days ago without follow-up task" },
  { type: "DEAL_AGING", severity: "info", enabled: true, threshold: 30, description: "Deal open for more than X days" },
  { type: "INACTIVE_ACCOUNT", severity: "info", enabled: true, threshold: 30, description: "Account without any activity for X days" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}


// ---------------------------------------------------------------------------
// AlertEngine
// ---------------------------------------------------------------------------

export class AlertEngine {
  private rules: AlertRule[];

  constructor(ruleOverrides?: Partial<AlertRule>[]) {
    this.rules = DEFAULT_ALERT_RULES.map((defaultRule) => {
      const override = ruleOverrides?.find((r) => r.type === defaultRule.type);
      return override ? { ...defaultRule, ...override } : { ...defaultRule };
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async generateAlerts(organizationId: string, ownerId?: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    const checks: Array<Promise<Alert[]>> = [];

    if (this.isEnabled("STALE_LEAD")) checks.push(this.checkStaleLeads(organizationId, ownerId));
    if (this.isEnabled("OVERDUE_TASK")) checks.push(this.checkOverdueTasks(organizationId, ownerId));
    if (this.isEnabled("STUCK_DEAL")) checks.push(this.checkStuckDeals(organizationId, ownerId));
    if (this.isEnabled("AT_RISK_DEAL")) checks.push(this.checkAtRiskDeals(organizationId, ownerId));
    if (this.isEnabled("NO_NEXT_STEP")) checks.push(this.checkNoNextStep(organizationId, ownerId));
    if (this.isEnabled("HIGH_VALUE_NO_MEETING")) checks.push(this.checkHighValueNoMeeting(organizationId, ownerId));
    if (this.isEnabled("CONVERSION_OVERDUE")) checks.push(this.checkConversionOverdue(organizationId, ownerId));
    if (this.isEnabled("MEETING_NO_FOLLOWUP")) checks.push(this.checkMeetingNoFollowup(organizationId, ownerId));
    if (this.isEnabled("DEAL_AGING")) checks.push(this.checkDealAging(organizationId, ownerId));

    const results = await Promise.all(checks);
    for (const batch of results) {
      alerts.push(...batch);
    }

    // Sort: critical first, then warning, then info; within same severity newest first
    const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  // -------------------------------------------------------------------------
  // Rule helpers
  // -------------------------------------------------------------------------

  private isEnabled(type: AlertType): boolean {
    return this.rules.find((r) => r.type === type)?.enabled ?? false;
  }

  private getThreshold(type: AlertType): number {
    return this.rules.find((r) => r.type === type)?.threshold ?? 0;
  }

  private getSeverity(type: AlertType): AlertSeverity {
    return this.rules.find((r) => r.type === type)?.severity ?? "info";
  }

  // -------------------------------------------------------------------------
  // Check implementations
  // -------------------------------------------------------------------------

  private async checkStaleLeads(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("STALE_LEAD");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    const staleLeads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
        updatedAt: { lt: cutoff },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 20,
    });

    return staleLeads.map((lead) => ({
      id: `stale-lead-${lead.id}`,
      type: "STALE_LEAD" as AlertType,
      severity: this.getSeverity("STALE_LEAD"),
      title: `Lead "${lead.name}" has no recent activity`,
      description: `This lead hasn't been updated in ${daysSince(lead.updatedAt)} days.`,
      reasoning: `Last update was ${lead.updatedAt.toISOString()}. Threshold is ${threshold} days.`,
      entityType: "lead",
      entityId: lead.id,
      entityName: lead.name,
      ownerId: lead.ownerId ?? undefined,
      ownerName: lead.owner?.name ?? undefined,
      actionLabel: "Follow up",
      actionUrl: `/leads/${lead.id}`,
      triggerValue: daysSince(lead.updatedAt),
      threshold,
      createdAt: new Date(),
    }));
  }

  private async checkOverdueTasks(orgId: string, ownerId?: string): Promise<Alert[]> {
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        status: { not: "COMPLETED" },
        dueDate: { lt: now },
      },
      include: {
        owner: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      take: 20,
    });

    return overdueTasks.map((task) => {
      const daysOver = task.dueDate ? daysSince(task.dueDate) : 0;
      return {
        id: `overdue-task-${task.id}`,
        type: "OVERDUE_TASK" as AlertType,
        severity: (daysOver > 7 ? "critical" : this.getSeverity("OVERDUE_TASK")) as AlertSeverity,
        title: `Task "${task.title}" is overdue`,
        description: `This task is ${daysOver} day${daysOver !== 1 ? "s" : ""} past due.${
          task.opportunity ? ` Related to deal: ${task.opportunity.title}` : ""
        }`,
        reasoning: `Due date was ${task.dueDate?.toISOString() ?? "unknown"}. Currently ${daysOver} days overdue.`,
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        ownerId: task.ownerId ?? undefined,
        ownerName: task.owner?.name ?? undefined,
        actionLabel: "Complete task",
        actionUrl: task.opportunityId
          ? `/opportunities/${task.opportunityId}`
          : task.leadId
            ? `/leads/${task.leadId}`
            : `/tasks`,
        triggerValue: daysOver,
        threshold: 0,
        createdAt: new Date(),
      };
    });
  }

  private async checkStuckDeals(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("STUCK_DEAL");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    const stuckDeals = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        updatedAt: { lt: cutoff },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 20,
    });

    return stuckDeals.map((opp) => {
      const inactive = daysSince(opp.updatedAt);
      return {
        id: `stuck-deal-${opp.id}`,
        type: "STUCK_DEAL" as AlertType,
        severity: (inactive > 30 ? "critical" : this.getSeverity("STUCK_DEAL")) as AlertSeverity,
        title: `Deal "${opp.title}" is stuck in ${opp.stage}`,
        description: `This deal hasn't been updated in ${inactive} days. Account: ${opp.account?.name ?? "Unknown"}.`,
        reasoning: `Last update was ${opp.updatedAt.toISOString()}. Threshold is ${threshold} days. Value: $${opp.value.toLocaleString()}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        ownerId: opp.ownerId ?? undefined,
        ownerName: opp.owner?.name ?? undefined,
        actionLabel: "Update deal",
        actionUrl: `/opportunities/${opp.id}`,
        triggerValue: inactive,
        threshold,
        createdAt: new Date(),
      };
    });
  }

  private async checkAtRiskDeals(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("AT_RISK_DEAL");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    const atRisk = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        value: { gte: 50000 },
        updatedAt: { lt: cutoff },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 20,
    });

    return atRisk.map((opp) => {
      const inactive = daysSince(opp.updatedAt);
      return {
        id: `at-risk-deal-${opp.id}`,
        type: "AT_RISK_DEAL" as AlertType,
        severity: this.getSeverity("AT_RISK_DEAL"),
        title: `High-value deal "${opp.title}" at risk`,
        description: `$${opp.value.toLocaleString()} deal has had no activity for ${inactive} days.`,
        reasoning: `Value is $${opp.value.toLocaleString()}, inactive for ${inactive} days (threshold ${threshold}). Account: ${opp.account?.name ?? "Unknown"}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        ownerId: opp.ownerId ?? undefined,
        ownerName: opp.owner?.name ?? undefined,
        actionLabel: "Review deal",
        actionUrl: `/opportunities/${opp.id}`,
        triggerValue: inactive,
        threshold,
        createdAt: new Date(),
      };
    });
  }

  private async checkNoNextStep(orgId: string, ownerId?: string): Promise<Alert[]> {
    const noNext = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        tasks: { none: { status: { not: "COMPLETED" } } },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 20,
    });

    return noNext.map((opp) => ({
      id: `no-next-step-${opp.id}`,
      type: "NO_NEXT_STEP" as AlertType,
      severity: this.getSeverity("NO_NEXT_STEP"),
      title: `Deal "${opp.title}" has no next step`,
      description: `This open deal has no pending tasks. Stage: ${opp.stage}. Account: ${opp.account?.name ?? "Unknown"}.`,
      reasoning: `No incomplete tasks found for this opportunity. Every active deal should have a defined next step.`,
      entityType: "opportunity",
      entityId: opp.id,
      entityName: opp.title,
      ownerId: opp.ownerId ?? undefined,
      ownerName: opp.owner?.name ?? undefined,
      actionLabel: "Create next step",
      actionUrl: `/opportunities/${opp.id}`,
      triggerValue: 0,
      threshold: 0,
      createdAt: new Date(),
    }));
  }

  private async checkHighValueNoMeeting(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("HIGH_VALUE_NO_MEETING");

    // Find high-value open deals
    const highValue = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        value: { gte: threshold },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: {
          include: {
            company: {
              include: {
                leads: {
                  include: {
                    meetings: { take: 1 },
                  },
                },
              },
            },
          },
        },
      },
      take: 20,
    });

    return highValue
      .filter((opp) => {
        // Check if any lead under the same company has at least one meeting
        const leads = opp.account?.company?.leads ?? [];
        const hasMeeting = leads.some((l) => l.meetings.length > 0);
        return !hasMeeting;
      })
      .map((opp) => ({
        id: `high-value-no-meeting-${opp.id}`,
        type: "HIGH_VALUE_NO_MEETING" as AlertType,
        severity: this.getSeverity("HIGH_VALUE_NO_MEETING"),
        title: `$${opp.value.toLocaleString()} deal "${opp.title}" has no meeting`,
        description: `This high-value deal has no meetings scheduled or completed. Consider booking a call.`,
        reasoning: `Deal value ($${opp.value.toLocaleString()}) exceeds threshold ($${threshold.toLocaleString()}) and no meetings are linked to associated leads.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        ownerId: opp.ownerId ?? undefined,
        ownerName: opp.owner?.name ?? undefined,
        actionLabel: "Schedule meeting",
        actionUrl: `/opportunities/${opp.id}`,
        triggerValue: opp.value,
        threshold,
        createdAt: new Date(),
      }));
  }

  private async checkConversionOverdue(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("CONVERSION_OVERDUE");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    const hotLeads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        temperature: "HOT",
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
        createdAt: { lt: cutoff },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 20,
    });

    return hotLeads.map((lead) => {
      const age = daysSince(lead.createdAt);
      return {
        id: `conversion-overdue-${lead.id}`,
        type: "CONVERSION_OVERDUE" as AlertType,
        severity: this.getSeverity("CONVERSION_OVERDUE"),
        title: `HOT lead "${lead.name}" not yet converted`,
        description: `This HOT lead was created ${age} days ago and has not been converted.`,
        reasoning: `Lead temperature is HOT, created ${age} days ago (threshold ${threshold} days). Status: ${lead.status}.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        ownerId: lead.ownerId ?? undefined,
        ownerName: lead.owner?.name ?? undefined,
        actionLabel: "Convert lead",
        actionUrl: `/leads/${lead.id}`,
        triggerValue: age,
        threshold,
        createdAt: new Date(),
      };
    });
  }

  private async checkMeetingNoFollowup(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("MEETING_NO_FOLLOWUP");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    // Meetings that ended before cutoff (i.e., at least `threshold` days ago)
    const pastMeetings = await prisma.meeting.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        startTime: { lt: cutoff },
      },
      include: {
        owner: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
      take: 40,
    });

    // For each meeting, check if the owner created a task after the meeting date
    const alerts: Alert[] = [];
    for (const meeting of pastMeetings) {
      const followupTask = meeting.leadId
        ? await prisma.task.findFirst({
            where: {
              ownerId: meeting.ownerId,
              createdAt: { gte: meeting.startTime },
              OR: [
                { leadId: meeting.leadId },
                { type: "FOLLOW_UP" },
              ],
            },
          })
        : await prisma.task.findFirst({
            where: {
              ownerId: meeting.ownerId,
              createdAt: { gte: meeting.startTime },
              type: "FOLLOW_UP",
            },
          });

      if (!followupTask) {
        const age = daysSince(meeting.startTime);
        alerts.push({
          id: `meeting-no-followup-${meeting.id}`,
          type: "MEETING_NO_FOLLOWUP" as AlertType,
          severity: this.getSeverity("MEETING_NO_FOLLOWUP"),
          title: `Meeting "${meeting.title}" has no follow-up`,
          description: `Meeting held ${age} days ago has no follow-up task created.`,
          reasoning: `Meeting "${meeting.title}" occurred on ${meeting.startTime.toISOString()}. No tasks created by owner after the meeting.`,
          entityType: "meeting",
          entityId: meeting.id,
          entityName: meeting.title,
          ownerId: meeting.ownerId ?? undefined,
          ownerName: meeting.owner?.name ?? undefined,
          actionLabel: "Create follow-up",
          actionUrl: meeting.leadId ? `/leads/${meeting.leadId}` : `/meetings`,
          triggerValue: age,
          threshold,
          createdAt: new Date(),
        });
      }

      if (alerts.length >= 20) break;
    }

    return alerts;
  }

  private async checkDealAging(orgId: string, ownerId?: string): Promise<Alert[]> {
    const threshold = this.getThreshold("DEAL_AGING");
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    const agingDeals = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        createdAt: { lt: cutoff },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 20,
    });

    return agingDeals.map((opp) => {
      const age = daysSince(opp.createdAt);
      return {
        id: `deal-aging-${opp.id}`,
        type: "DEAL_AGING" as AlertType,
        severity: (age > 60 ? "warning" : this.getSeverity("DEAL_AGING")) as AlertSeverity,
        title: `Deal "${opp.title}" has been open for ${age} days`,
        description: `This deal was created ${age} days ago and is still in ${opp.stage}. Account: ${opp.account?.name ?? "Unknown"}.`,
        reasoning: `Deal created on ${opp.createdAt.toISOString()}, age ${age} days (threshold ${threshold} days). Value: $${opp.value.toLocaleString()}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        ownerId: opp.ownerId ?? undefined,
        ownerName: opp.owner?.name ?? undefined,
        actionLabel: "Review deal",
        actionUrl: `/opportunities/${opp.id}`,
        triggerValue: age,
        threshold,
        createdAt: new Date(),
      };
    });
  }
}
