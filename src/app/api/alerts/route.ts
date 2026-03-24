import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { buildScopeFilter, actorFromSession } from "@/lib/authorization";

type AlertType =
  | "STALE_LEAD"
  | "OVERDUE_TASK"
  | "STUCK_DEAL"
  | "AT_RISK_DEAL"
  | "NO_NEXT_STEP"
  | "HIGH_VALUE_ALERT"
  | "UPCOMING_DEADLINE";

type Severity = "critical" | "warning" | "info";

interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  entityType: "lead" | "opportunity" | "task";
  entityId: string;
  entityName: string;
  actionUrl: string;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const orgId = session.user.organizationId;
    const userId = session.user.id;
    const now = new Date();

    const leadScope = buildScopeFilter(actor, "lead");
    const oppScope = buildScopeFilter(actor, "opportunity");
    const taskScope = buildScopeFilter(actor, "task");

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const alerts: Alert[] = [];

    // Run all queries in parallel
    const [
      staleLeads,
      overdueTasks,
      stuckDeals,
      atRiskDeals,
      noNextStepDeals,
      highValueDeals,
      upcomingDeadlineDeals,
    ] = await Promise.all([
      // 1. STALE_LEAD - Leads not converted/disqualified with no contact or contact > 7 days
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          ...leadScope,
          status: { notIn: ["CONVERTED", "DISQUALIFIED"] },
          OR: [
            { lastContact: null },
            { lastContact: { lt: sevenDaysAgo } },
          ],
        },
        include: {
          company: { select: { name: true } },
        },
      }),

      // 2. OVERDUE_TASK - Tasks not completed with dueDate in the past
      prisma.task.findMany({
        where: {
          organizationId: orgId,
          ...taskScope,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        },
        include: {
          opportunity: { select: { title: true } },
        },
      }),

      // 3. STUCK_DEAL - Open opportunities not updated in 14 days
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          ...oppScope,
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          updatedAt: { lt: fourteenDaysAgo },
        },
        include: {
          account: { select: { name: true } },
        },
      }),

      // 4. AT_RISK_DEAL - Open opportunities with probability < 30
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          ...oppScope,
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          probability: { lt: 30 },
        },
        include: {
          account: { select: { name: true } },
        },
      }),

      // 5. NO_NEXT_STEP - Open opportunities with zero incomplete tasks
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          ...oppScope,
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          tasks: {
            none: {
              status: { not: "COMPLETED" },
            },
          },
        },
        include: {
          account: { select: { name: true } },
        },
      }),

      // 6. HIGH_VALUE_ALERT - High value (>100k) with low probability (<50)
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          ...oppScope,
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
          value: { gt: 100000 },
          probability: { lt: 50 },
        },
        include: {
          account: { select: { name: true } },
        },
      }),

      // 7. UPCOMING_DEADLINE - Close date within 7 days, still early stage
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          ...oppScope,
          stage: { in: ["DISCOVERY", "QUALIFICATION", "discovery", "qualification"] },
          expectedCloseDate: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
        include: {
          account: { select: { name: true } },
        },
      }),
    ]);

    // Process STALE_LEAD alerts
    for (const lead of staleLeads) {
      const daysSince = lead.lastContact
        ? Math.floor((now.getTime() - new Date(lead.lastContact).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      alerts.push({
        id: `alert-stale-${lead.id}`,
        type: "STALE_LEAD",
        severity: daysSince === null || daysSince > 14 ? "critical" : "warning",
        title: `Stale lead: ${lead.name}`,
        description: daysSince === null
          ? `Lead "${lead.name}" has never been contacted.`
          : `Lead "${lead.name}" has not been contacted in ${daysSince} days.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        actionUrl: `/leads/${lead.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Process OVERDUE_TASK alerts
    for (const task of overdueTasks) {
      const daysOverdue = task.dueDate
        ? Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      alerts.push({
        id: `alert-overdue-${task.id}`,
        type: "OVERDUE_TASK",
        severity: daysOverdue > 7 ? "critical" : "warning",
        title: `Overdue task: ${task.title}`,
        description: `Task "${task.title}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue.${
          task.opportunity ? ` Related to deal: ${task.opportunity.title}` : ""
        }`,
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        actionUrl: task.opportunityId
          ? `/opportunities/${task.opportunityId}`
          : task.leadId
            ? `/leads/${task.leadId}`
            : `/tasks`,
        createdAt: now.toISOString(),
      });
    }

    // Process STUCK_DEAL alerts
    for (const opp of stuckDeals) {
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        id: `alert-stuck-${opp.id}`,
        type: "STUCK_DEAL",
        severity: daysSinceUpdate > 30 ? "critical" : "warning",
        title: `Stuck deal: ${opp.title}`,
        description: `Deal "${opp.title}" (${opp.account?.name || "Unknown account"}) has not been updated in ${daysSinceUpdate} days. Stage: ${opp.stage}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        actionUrl: `/opportunities/${opp.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Process AT_RISK_DEAL alerts
    for (const opp of atRiskDeals) {
      alerts.push({
        id: `alert-atrisk-${opp.id}`,
        type: "AT_RISK_DEAL",
        severity: opp.probability < 10 ? "critical" : "warning",
        title: `At-risk deal: ${opp.title}`,
        description: `Deal "${opp.title}" (${opp.account?.name || "Unknown account"}) has only ${opp.probability}% probability. Value: $${opp.value.toLocaleString()}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        actionUrl: `/opportunities/${opp.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Process NO_NEXT_STEP alerts
    for (const opp of noNextStepDeals) {
      alerts.push({
        id: `alert-nonext-${opp.id}`,
        type: "NO_NEXT_STEP",
        severity: "warning",
        title: `No next step: ${opp.title}`,
        description: `Deal "${opp.title}" (${opp.account?.name || "Unknown account"}) has no pending tasks. Stage: ${opp.stage}.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        actionUrl: `/opportunities/${opp.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Process HIGH_VALUE_ALERT alerts
    for (const opp of highValueDeals) {
      alerts.push({
        id: `alert-highval-${opp.id}`,
        type: "HIGH_VALUE_ALERT",
        severity: "critical",
        title: `High-value deal at risk: ${opp.title}`,
        description: `Deal "${opp.title}" (${opp.account?.name || "Unknown account"}) is worth $${opp.value.toLocaleString()} but has only ${opp.probability}% probability.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        actionUrl: `/opportunities/${opp.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Process UPCOMING_DEADLINE alerts
    for (const opp of upcomingDeadlineDeals) {
      const daysUntilClose = opp.expectedCloseDate
        ? Math.ceil((new Date(opp.expectedCloseDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      alerts.push({
        id: `alert-deadline-${opp.id}`,
        type: "UPCOMING_DEADLINE",
        severity: daysUntilClose <= 3 ? "critical" : "info",
        title: `Deadline approaching: ${opp.title}`,
        description: `Deal "${opp.title}" (${opp.account?.name || "Unknown account"}) is expected to close in ${daysUntilClose} day${daysUntilClose !== 1 ? "s" : ""} but is still in ${opp.stage} stage.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        actionUrl: `/opportunities/${opp.id}`,
        createdAt: now.toISOString(),
      });
    }

    // Build summary
    const summary = {
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
      total: alerts.length,
    };

    // Sort: critical first, then warning, then info
    const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return sendSuccess({ alerts, summary });
  } catch (error: any) {
    console.error("GET /api/alerts error:", error);
    return sendUnhandledError();
  }
}
