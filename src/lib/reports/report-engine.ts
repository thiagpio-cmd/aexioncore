import { prisma } from "@/lib/db";
import { AlertEngine, Alert } from "@/lib/intelligence/alert-engine";
import {
  RecommendationEngine,
  Recommendation,
} from "@/lib/intelligence/recommendation-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportInput {
  organizationId: string;
  generatedById: string;
  period: string; // "7d" | "30d" | "90d" | "365d" | "custom"
  periodStart?: Date;
  periodEnd?: Date;
  modules: string[]; // ["pipeline", "leads", "activities", "forecast", "alerts", "recommendations", "team"]
  filters?: {
    repId?: string;
    stage?: string;
    source?: string;
    segment?: string;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  type:
    | "summary"
    | "metrics"
    | "findings"
    | "bottlenecks"
    | "risks"
    | "recommendations"
    | "table"
    | "chart_data";
  content: string; // Human-readable text
  data?: Record<string, unknown>; // Structured data for rendering
  source: string; // Which engine/data source produced this
  confidence?: string; // "high" | "medium" | "low"
}

export interface ReportOutput {
  id: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  period: { label: string; start: string; end: string };
  modules: string[];
  filters: Record<string, string>;
  sections: ReportSection[];
  executiveSynthesis: {
    summary: string;
    keyFindings: string[];
    criticalRisks: string[];
    topRecommendations: string[];
    methodology: string;
  };
  metadata: {
    dataPoints: number;
    alertsAnalyzed: number;
    recommendationsGenerated: number;
    synthesisMethod: "template_heuristic";
  };
}

interface DateRange {
  label: string;
  start: string;
  end: string;
  startDate: Date;
  endDate: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------------------
// ReportEngine
// ---------------------------------------------------------------------------

export class ReportEngine {
  private alertEngine = new AlertEngine();
  private recommendationEngine = new RecommendationEngine();

  async generate(input: ReportInput): Promise<ReportOutput> {
    const dateRange = this.resolveDateRange(
      input.period,
      input.periodStart,
      input.periodEnd
    );
    const sections: ReportSection[] = [];
    let dataPoints = 0;

    // Build sections based on selected modules
    if (input.modules.includes("pipeline")) {
      const pipelineSections = await this.buildPipelineSection(
        input.organizationId,
        dateRange,
        input.filters
      );
      sections.push(...pipelineSections);
      dataPoints += pipelineSections.reduce(
        (sum, s) => sum + Object.keys(s.data || {}).length,
        0
      );
    }

    if (input.modules.includes("leads")) {
      const leadsSections = await this.buildLeadsSection(
        input.organizationId,
        dateRange,
        input.filters
      );
      sections.push(...leadsSections);
      dataPoints += leadsSections.reduce(
        (sum, s) => sum + Object.keys(s.data || {}).length,
        0
      );
    }

    if (input.modules.includes("activities")) {
      const activitiesSections = await this.buildActivitiesSection(
        input.organizationId,
        dateRange,
        input.filters
      );
      sections.push(...activitiesSections);
      dataPoints += activitiesSections.reduce(
        (sum, s) => sum + Object.keys(s.data || {}).length,
        0
      );
    }

    if (input.modules.includes("team")) {
      const teamSections = await this.buildTeamSection(
        input.organizationId,
        dateRange,
        input.filters
      );
      sections.push(...teamSections);
      dataPoints += teamSections.reduce(
        (sum, s) => sum + Object.keys(s.data || {}).length,
        0
      );
    }

    if (input.modules.includes("forecast")) {
      const forecastSections = await this.buildForecastSection(
        input.organizationId,
        dateRange
      );
      sections.push(...forecastSections);
      dataPoints += forecastSections.reduce(
        (sum, s) => sum + Object.keys(s.data || {}).length,
        0
      );
    }

    // ALWAYS include alerts and recommendations from engines
    const alerts = await this.alertEngine.generateAlerts(
      input.organizationId,
      input.filters?.repId
    );
    const recommendations =
      await this.recommendationEngine.generateRecommendations(
        input.organizationId,
        { ownerId: input.filters?.repId, limit: 20 }
      );

    sections.push({
      id: "alerts",
      title: "Active Alerts",
      type: "risks",
      content: `${alerts.length} active alerts detected: ${alerts.filter((a) => a.severity === "critical").length} critical, ${alerts.filter((a) => a.severity === "warning").length} warnings, ${alerts.filter((a) => a.severity === "info").length} informational.`,
      data: {
        alerts: alerts.slice(0, 15).map((a) => ({
          type: a.type,
          severity: a.severity,
          title: a.title,
          description: a.description,
          reasoning: a.reasoning,
          entityType: a.entityType,
          entityName: a.entityName,
          actionLabel: a.actionLabel,
          actionUrl: a.actionUrl,
        })),
        summary: {
          critical: alerts.filter((a) => a.severity === "critical").length,
          warning: alerts.filter((a) => a.severity === "warning").length,
          info: alerts.filter((a) => a.severity === "info").length,
        },
      },
      source: "AlertEngine",
      confidence: "high",
    });

    sections.push({
      id: "recommendations",
      title: "Recommended Actions",
      type: "recommendations",
      content: `${recommendations.length} actionable recommendations generated based on current operational data.`,
      data: {
        recommendations: recommendations.slice(0, 10).map((r) => ({
          type: r.type,
          priority: r.priority,
          title: r.title,
          description: r.description,
          reasoning: r.reasoning,
          confidence: r.confidence,
          impact: r.impact,
          effort: r.effort,
          actionLabel: r.actionLabel,
          actionUrl: r.actionUrl,
        })),
      },
      source: "RecommendationEngine",
      confidence: "high",
    });

    // Generate executive synthesis (template-based, NOT AI)
    const synthesis = this.generateSynthesis(
      sections,
      alerts,
      recommendations,
      dateRange
    );

    return {
      id: `report-${Date.now()}`,
      title: this.generateTitle(input),
      subtitle: `Generated on ${new Date().toLocaleDateString()} — ${dateRange.label}`,
      generatedAt: new Date().toISOString(),
      period: {
        label: dateRange.label,
        start: dateRange.start,
        end: dateRange.end,
      },
      modules: input.modules,
      filters: (input.filters as Record<string, string>) || {},
      sections,
      executiveSynthesis: synthesis,
      metadata: {
        dataPoints,
        alertsAnalyzed: alerts.length,
        recommendationsGenerated: recommendations.length,
        synthesisMethod: "template_heuristic",
      },
    };
  }

  // ─── Section builders (use REAL Prisma queries) ──────────────────────────

  private async buildPipelineSection(
    orgId: string,
    dateRange: DateRange,
    filters?: ReportInput["filters"]
  ): Promise<ReportSection[]> {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
    };
    if (filters?.stage) where.stage = filters.stage;
    if (filters?.repId) where.ownerId = filters.repId;

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        account: { select: { name: true } },
      },
    });

    const totalValue = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);
    const avgValue =
      opportunities.length > 0 ? totalValue / opportunities.length : 0;

    const byStage: Record<string, { count: number; value: number }> = {};
    opportunities.forEach((o) => {
      if (!byStage[o.stage]) byStage[o.stage] = { count: 0, value: 0 };
      byStage[o.stage].count++;
      byStage[o.stage].value += o.value || 0;
    });

    const wonDeals = opportunities.filter((o) => o.stage === "CLOSED_WON");
    const lostDeals = opportunities.filter((o) => o.stage === "CLOSED_LOST");
    const winRate =
      wonDeals.length + lostDeals.length > 0
        ? Math.round(
            (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
          )
        : 0;

    const sections: ReportSection[] = [];

    sections.push({
      id: "pipeline-metrics",
      title: "Pipeline Overview",
      type: "metrics",
      content: `Total pipeline: ${formatBRL(totalValue)}. ${opportunities.length} deals with average size ${formatBRL(avgValue)}. Win rate: ${winRate}%.`,
      data: {
        totalValue,
        dealCount: opportunities.length,
        avgValue,
        winRate,
        byStage,
        wonRevenue: wonDeals.reduce((s, o) => s + (o.value || 0), 0),
        lostRevenue: lostDeals.reduce((s, o) => s + (o.value || 0), 0),
      },
      source: "prisma",
      confidence: "high",
    });

    // Bottlenecks: deals stuck for >14 days without progression
    const stuckDeals = opportunities.filter((o) => {
      const daysSince = Math.floor(
        (Date.now() - new Date(o.updatedAt).getTime()) / 86400000
      );
      return daysSince > 14 && !o.stage.includes("CLOSED");
    });

    if (stuckDeals.length > 0) {
      sections.push({
        id: "pipeline-bottlenecks",
        title: "Pipeline Bottlenecks",
        type: "bottlenecks",
        content: `${stuckDeals.length} deals stuck for more than 14 days without progression.`,
        data: {
          stuckDeals: stuckDeals.map((d) => ({
            title: d.title,
            stage: d.stage,
            value: d.value,
            daysSinceUpdate: Math.floor(
              (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
            ),
            owner: d.owner?.name,
            account: d.account?.name,
          })),
        },
        source: "prisma",
        confidence: "high",
      });
    }

    return sections;
  }

  private async buildLeadsSection(
    orgId: string,
    dateRange: DateRange,
    filters?: ReportInput["filters"]
  ): Promise<ReportSection[]> {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
    };
    if (filters?.repId) where.ownerId = filters.repId;
    if (filters?.source) where.source = filters.source;

    const leads = await prisma.lead.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
    });

    const sections: ReportSection[] = [];

    // Count by status
    const byStatus: Record<string, number> = {};
    leads.forEach((l) => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });

    // Count by temperature
    const byTemperature: Record<string, number> = {};
    leads.forEach((l) => {
      byTemperature[l.temperature] = (byTemperature[l.temperature] || 0) + 1;
    });

    // Count by source
    const bySource: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.source || "unknown";
      bySource[src] = (bySource[src] || 0) + 1;
    });

    // Conversion rate
    const convertedCount = leads.filter((l) => l.status === "CONVERTED").length;
    const conversionRate =
      leads.length > 0 ? Math.round((convertedCount / leads.length) * 100) : 0;

    sections.push({
      id: "leads-overview",
      title: "Leads Overview",
      type: "metrics",
      content: `${leads.length} leads in the period. Conversion rate: ${conversionRate}%. ${byTemperature["HOT"] || 0} hot, ${byTemperature["WARM"] || 0} warm, ${byTemperature["COLD"] || 0} cold.`,
      data: {
        totalLeads: leads.length,
        conversionRate,
        convertedCount,
        byStatus,
        byTemperature,
        bySource,
      },
      source: "prisma",
      confidence: "high",
    });

    // Hot leads not yet converted
    const hotNotConverted = leads.filter(
      (l) => l.temperature === "HOT" && l.status !== "CONVERTED"
    );
    if (hotNotConverted.length > 0) {
      sections.push({
        id: "leads-hot-unconverted",
        title: "Hot Leads Pending Conversion",
        type: "findings",
        content: `${hotNotConverted.length} hot leads have not yet been converted.`,
        data: {
          leads: hotNotConverted.slice(0, 15).map((l) => ({
            name: l.name,
            email: l.email,
            status: l.status,
            fitScore: l.fitScore,
            owner: l.owner?.name,
            daysSinceCreation: Math.floor(
              (Date.now() - new Date(l.createdAt).getTime()) / 86400000
            ),
          })),
        },
        source: "prisma",
        confidence: "high",
      });
    }

    // Stale leads (no contact in 7+ days)
    const staleLeads = leads.filter((l) => {
      if (!l.lastContact) return true;
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(l.lastContact).getTime()) / 86400000
      );
      return (
        daysSinceContact > 7 &&
        l.status !== "CONVERTED" &&
        l.status !== "UNQUALIFIED"
      );
    });
    if (staleLeads.length > 0) {
      sections.push({
        id: "leads-stale",
        title: "Stale Leads",
        type: "findings",
        content: `${staleLeads.length} leads without contact in the last 7 days.`,
        data: {
          count: staleLeads.length,
          leads: staleLeads.slice(0, 10).map((l) => ({
            name: l.name,
            status: l.status,
            temperature: l.temperature,
            owner: l.owner?.name,
            lastContact: l.lastContact?.toISOString() || null,
          })),
        },
        source: "prisma",
        confidence: "high",
      });
    }

    return sections;
  }

  private async buildActivitiesSection(
    orgId: string,
    dateRange: DateRange,
    filters?: ReportInput["filters"]
  ): Promise<ReportSection[]> {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
    };
    if (filters?.repId) where.creatorId = filters.repId;

    const activities = await prisma.activity.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      take: 1000,
    });

    const sections: ReportSection[] = [];

    // Count by type
    const byType: Record<string, number> = {};
    activities.forEach((a) => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });

    // Count by user
    const byUser: Record<string, { name: string; count: number }> = {};
    activities.forEach((a) => {
      const userId = a.creatorId || "unknown";
      if (!byUser[userId]) {
        byUser[userId] = { name: a.creator?.name || "Unknown", count: 0 };
      }
      byUser[userId].count++;
    });

    // Calculate period days for rate
    const periodDays = Math.max(
      1,
      Math.floor(
        (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / 86400000
      )
    );
    const dailyRate =
      activities.length > 0
        ? Math.round((activities.length / periodDays) * 10) / 10
        : 0;

    sections.push({
      id: "activities-overview",
      title: "Activity Overview",
      type: "metrics",
      content: `${activities.length} activities logged in the period (${dailyRate}/day). Top type: ${Object.entries(byType).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A"}.`,
      data: {
        totalActivities: activities.length,
        dailyRate,
        periodDays,
        byType,
        byUser: Object.values(byUser).sort((a, b) => b.count - a.count),
      },
      source: "prisma",
      confidence: "high",
    });

    // Reps with low activity (below average)
    const userCounts = Object.values(byUser);
    if (userCounts.length > 1) {
      const avgActivity =
        userCounts.reduce((sum, u) => sum + u.count, 0) / userCounts.length;
      const lowActivityReps = userCounts.filter(
        (u) => u.count < avgActivity * 0.5
      );
      if (lowActivityReps.length > 0) {
        sections.push({
          id: "activities-low-performers",
          title: "Low Activity Reps",
          type: "findings",
          content: `${lowActivityReps.length} reps have activity below 50% of the team average (${Math.round(avgActivity)} activities).`,
          data: {
            avgActivity: Math.round(avgActivity),
            lowActivityReps,
          },
          source: "prisma",
          confidence: "medium",
        });
      }
    }

    return sections;
  }

  private async buildTeamSection(
    orgId: string,
    dateRange: DateRange,
    filters?: ReportInput["filters"]
  ): Promise<ReportSection[]> {
    // Fetch reps in the org
    const users = await prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, role: true },
    });

    const oppWhere: Record<string, unknown> = {
      organizationId: orgId,
      createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
    };
    if (filters?.repId) oppWhere.ownerId = filters.repId;

    const [opportunities, tasks, activities] = await Promise.all([
      prisma.opportunity.findMany({ where: oppWhere }),
      prisma.task.findMany({
        where: {
          organizationId: orgId,
          ...(filters?.repId ? { ownerId: filters.repId } : {}),
        },
      }),
      prisma.activity.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
          ...(filters?.repId ? { creatorId: filters.repId } : {}),
        },
      }),
    ]);

    const sections: ReportSection[] = [];

    const repPerformance = users.map((user) => {
      const repOpps = opportunities.filter((o) => o.ownerId === user.id);
      const repWon = repOpps.filter((o) => o.stage === "CLOSED_WON");
      const repLost = repOpps.filter((o) => o.stage === "CLOSED_LOST");
      const repActive = repOpps.filter(
        (o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST"
      );
      const repTasks = tasks.filter((t) => t.ownerId === user.id);
      const repOverdue = repTasks.filter(
        (t) =>
          t.dueDate &&
          t.status !== "COMPLETED" &&
          new Date(t.dueDate) < new Date()
      );
      const repActivities = activities.filter(
        (a) => a.creatorId === user.id
      );
      const closedCount = repWon.length + repLost.length;

      return {
        name: user.name,
        role: user.role,
        deals: repOpps.length,
        won: repWon.length,
        lost: repLost.length,
        active: repActive.length,
        revenue: repWon.reduce((s, o) => s + (o.value || 0), 0),
        pipeline: repActive.reduce((s, o) => s + (o.value || 0), 0),
        winRate:
          closedCount > 0
            ? Math.round((repWon.length / closedCount) * 100)
            : 0,
        totalTasks: repTasks.length,
        overdueTasks: repOverdue.length,
        activities: repActivities.length,
      };
    });

    // Only include reps who have at least some data
    const activeReps = repPerformance.filter(
      (r) => r.deals > 0 || r.totalTasks > 0 || r.activities > 0
    );

    sections.push({
      id: "team-performance",
      title: "Team Performance",
      type: "table",
      content: `${activeReps.length} active reps. Total revenue: ${formatBRL(activeReps.reduce((s, r) => s + r.revenue, 0))}. Total overdue tasks: ${activeReps.reduce((s, r) => s + r.overdueTasks, 0)}.`,
      data: {
        reps: activeReps.sort((a, b) => b.revenue - a.revenue),
        totals: {
          deals: activeReps.reduce((s, r) => s + r.deals, 0),
          won: activeReps.reduce((s, r) => s + r.won, 0),
          lost: activeReps.reduce((s, r) => s + r.lost, 0),
          revenue: activeReps.reduce((s, r) => s + r.revenue, 0),
          pipeline: activeReps.reduce((s, r) => s + r.pipeline, 0),
          overdueTasks: activeReps.reduce((s, r) => s + r.overdueTasks, 0),
          activities: activeReps.reduce((s, r) => s + r.activities, 0),
        },
      },
      source: "prisma",
      confidence: "high",
    });

    return sections;
  }

  private async buildForecastSection(
    orgId: string,
    dateRange: DateRange
  ): Promise<ReportSection[]> {
    const activeOpps = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      include: { owner: { select: { name: true } } },
    });

    const sections: ReportSection[] = [];

    const commitDeals = activeOpps.filter((o) => o.probability >= 70);
    const bestCaseDeals = activeOpps.filter((o) => o.probability >= 40);

    const commitValue = commitDeals.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    );
    const bestCaseValue = bestCaseDeals.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    );
    const weightedValue = activeOpps.reduce(
      (sum, o) => sum + ((o.value || 0) * (o.probability || 0)) / 100,
      0
    );
    const totalPipeline = activeOpps.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    );

    // Deals closing soon (within 30 days)
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );
    const closingSoon = activeOpps.filter(
      (o) =>
        o.expectedCloseDate && new Date(o.expectedCloseDate) <= thirtyDaysFromNow
    );

    sections.push({
      id: "forecast-overview",
      title: "Forecast Overview",
      type: "metrics",
      content: `Forecast commit: ${formatBRL(commitValue)}. Best case: ${formatBRL(bestCaseValue)}. Weighted pipeline: ${formatBRL(Math.round(weightedValue))}. ${closingSoon.length} deals expected to close within 30 days.`,
      data: {
        commit: commitValue,
        bestCase: bestCaseValue,
        weighted: Math.round(weightedValue),
        totalPipeline,
        commitDeals: commitDeals.length,
        bestCaseDeals: bestCaseDeals.length,
        totalDeals: activeOpps.length,
        closingSoon: closingSoon.length,
        closingSoonValue: closingSoon.reduce(
          (s, o) => s + (o.value || 0),
          0
        ),
        closingSoonDetails: closingSoon.slice(0, 10).map((o) => ({
          title: o.title,
          value: o.value,
          probability: o.probability,
          stage: o.stage,
          owner: o.owner?.name,
          expectedCloseDate: o.expectedCloseDate?.toISOString(),
        })),
      },
      source: "prisma",
      confidence: "high",
    });

    // Pipeline coverage analysis
    // A healthy pipeline typically needs 3x the target in pipeline
    if (commitValue > 0 && totalPipeline > 0) {
      const coverage = Math.round((totalPipeline / commitValue) * 10) / 10;
      sections.push({
        id: "forecast-coverage",
        title: "Pipeline Coverage",
        type: "findings",
        content: `Pipeline coverage ratio: ${coverage}x commit value. ${coverage >= 3 ? "Healthy coverage." : "Coverage below recommended 3x threshold — pipeline generation may be needed."}`,
        data: { coverage, commitValue, totalPipeline },
        source: "prisma",
        confidence: "medium",
      });
    }

    return sections;
  }

  // ─── Synthesis (TEMPLATE-BASED, not AI) ──────────────────────────────────

  private generateSynthesis(
    sections: ReportSection[],
    alerts: Alert[],
    recommendations: Recommendation[],
    dateRange: DateRange
  ) {
    const keyFindings: string[] = [];
    const criticalRisks: string[] = [];
    const topRecommendations: string[] = [];

    // Extract findings from pipeline section
    const pipelineMetrics = sections.find((s) => s.id === "pipeline-metrics");
    if (pipelineMetrics?.data) {
      const d = pipelineMetrics.data as Record<string, unknown>;
      keyFindings.push(
        `Pipeline contains ${d.dealCount} deals worth ${formatBRL(d.totalValue as number)} with a ${d.winRate}% win rate.`
      );
    }

    // Extract findings from leads section
    const leadsOverview = sections.find((s) => s.id === "leads-overview");
    if (leadsOverview?.data) {
      const d = leadsOverview.data as Record<string, unknown>;
      keyFindings.push(
        `${d.totalLeads} leads analyzed with ${d.conversionRate}% conversion rate.`
      );
    }

    // Extract findings from forecast section
    const forecastOverview = sections.find((s) => s.id === "forecast-overview");
    if (forecastOverview?.data) {
      const d = forecastOverview.data as Record<string, unknown>;
      keyFindings.push(
        `Forecast commit at ${formatBRL(d.commit as number)}, weighted pipeline at ${formatBRL(d.weighted as number)}.`
      );
    }

    // Extract findings from team section
    const teamPerf = sections.find((s) => s.id === "team-performance");
    if (teamPerf?.data) {
      const totals = (teamPerf.data as Record<string, unknown>)
        .totals as Record<string, number>;
      if (totals.overdueTasks > 0) {
        keyFindings.push(
          `Team has ${totals.overdueTasks} overdue tasks requiring attention.`
        );
      }
    }

    // Extract risks from alerts
    alerts
      .filter((a) => a.severity === "critical")
      .slice(0, 3)
      .forEach((a) => {
        criticalRisks.push(`${a.title}: ${a.reasoning}`);
      });

    // Extract top recommendations
    recommendations
      .filter((r) => r.priority === "high")
      .slice(0, 3)
      .forEach((r) => {
        topRecommendations.push(`${r.title}: ${r.reasoning}`);
      });

    // Build summary from template
    const criticalCount = alerts.filter(
      (a) => a.severity === "critical"
    ).length;
    const summary = this.buildSummaryTemplate(
      sections,
      criticalCount,
      recommendations.length,
      dateRange
    );

    return {
      summary,
      keyFindings:
        keyFindings.length > 0
          ? keyFindings
          : ["No significant findings in the analyzed period."],
      criticalRisks:
        criticalRisks.length > 0
          ? criticalRisks
          : ["No critical risks detected in the analyzed period."],
      topRecommendations:
        topRecommendations.length > 0
          ? topRecommendations
          : ["No high-priority recommendations at this time."],
      methodology:
        "Template-based heuristic synthesis grounded in system data. This analysis uses deterministic rules applied to actual operational data — it is not generated by a language model or adaptive AI.",
    };
  }

  private buildSummaryTemplate(
    sections: ReportSection[],
    criticalAlerts: number,
    recsCount: number,
    dateRange: DateRange
  ): string {
    let summary = `Report covering ${dateRange.label}. `;

    const pipeline = sections.find((s) => s.id === "pipeline-metrics");
    if (pipeline?.data) {
      const d = pipeline.data as Record<string, unknown>;
      summary += `The pipeline holds ${d.dealCount} deals. `;
      const winRate = d.winRate as number;
      if (winRate < 20)
        summary += `Win rate at ${winRate}% is below healthy threshold. `;
      else if (winRate > 40)
        summary += `Win rate at ${winRate}% is strong. `;
    }

    const leads = sections.find((s) => s.id === "leads-overview");
    if (leads?.data) {
      const d = leads.data as Record<string, unknown>;
      summary += `${d.totalLeads} leads tracked with ${d.conversionRate}% conversion. `;
    }

    if (criticalAlerts > 0) {
      summary += `There are ${criticalAlerts} critical alerts requiring immediate attention. `;
    }

    summary += `${recsCount} operational recommendations were generated from current data.`;

    return summary;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private resolveDateRange(
    period: string,
    start?: Date,
    end?: Date
  ): DateRange {
    const now = new Date();
    const endDate = end || now;

    const periodDays: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "365d": 365,
    };

    if (period === "custom" && start) {
      return {
        label: `${start.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        start: start.toISOString(),
        end: endDate.toISOString(),
        startDate: start,
        endDate,
      };
    }

    const days = periodDays[period] || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return {
      label: `Last ${days} days`,
      start: startDate.toISOString(),
      end: now.toISOString(),
      startDate,
      endDate: now,
    };
  }

  private generateTitle(input: ReportInput): string {
    const moduleLabels: Record<string, string> = {
      pipeline: "Pipeline",
      leads: "Leads",
      activities: "Activities",
      team: "Team",
      forecast: "Forecast",
      alerts: "Alerts",
      recommendations: "Recommendations",
    };

    if (input.modules.length >= 5) {
      return "Executive Summary Report";
    }

    const labels = input.modules
      .filter((m) => moduleLabels[m])
      .map((m) => moduleLabels[m]);

    return labels.length > 0
      ? `${labels.join(" & ")} Report`
      : "Operational Report";
  }
}

// Singleton export
export const reportEngine = new ReportEngine();
