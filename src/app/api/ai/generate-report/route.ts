import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

type ReportType =
  | "weekly_digest"
  | "monthly_review"
  | "pipeline_analysis"
  | "team_performance"
  | "forecast_accuracy";

type ReportPeriod = "7d" | "30d" | "90d";
type ReportFormat = "summary" | "detailed";

interface ReportHighlight {
  type: "win" | "concern" | "trend";
  text: string;
}

interface ReportRecommendation {
  action: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  detail: string;
}

interface TeamPerformanceEntry {
  name: string;
  activities: number;
  conversions: number;
  trend: "up" | "down" | "stable";
}

function getPeriodDate(period: ReportPeriod): Date {
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function periodLabel(period: ReportPeriod): string {
  return period === "7d" ? "past 7 days" : period === "30d" ? "past 30 days" : "past 90 days";
}

/**
 * POST /api/ai/generate-report
 *
 * Generates a comprehensive executive report with AI narrative or deterministic templates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const roleError = requireRole(session.user as any, "SDR");
    if (roleError) return roleError;

    const body = await request.json();
    const { type, period, format } = body as {
      type?: ReportType;
      period?: ReportPeriod;
      format?: ReportFormat;
    };

    const validTypes: ReportType[] = [
      "weekly_digest",
      "monthly_review",
      "pipeline_analysis",
      "team_performance",
      "forecast_accuracy",
    ];
    const validPeriods: ReportPeriod[] = ["7d", "30d", "90d"];
    const validFormats: ReportFormat[] = ["summary", "detailed"];

    if (!type || !validTypes.includes(type)) {
      return sendError(badRequest("Invalid type. Must be one of: " + validTypes.join(", ")));
    }
    if (!period || !validPeriods.includes(period)) {
      return sendError(badRequest("Invalid period. Must be one of: " + validPeriods.join(", ")));
    }
    const reportFormat: ReportFormat = format && validFormats.includes(format) ? format : "summary";

    const orgId = session.user.organizationId;
    const now = new Date();
    const periodStart = getPeriodDate(period);

    // ── Gather ALL relevant metrics ──────────────────────────────────────

    const [opportunities, leads, activities, tasks, users] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: orgId },
        include: {
          account: { select: { name: true } },
          owner: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId },
        include: { owner: { select: { id: true, name: true } } },
      }),
      prisma.activity.findMany({
        where: { organizationId: orgId },
        include: { creator: { select: { id: true, name: true } } },
      }),
      prisma.task.findMany({
        where: { organizationId: orgId },
        include: { owner: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, role: true },
      }),
    ]);

    // ── Pipeline metrics ─────────────────────────────────────────────────

    const activeOpps = opportunities.filter(
      (o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST"
    );
    const wonOpps = opportunities.filter((o) => o.stage === "CLOSED_WON");
    const lostOpps = opportunities.filter((o) => o.stage === "CLOSED_LOST");

    const wonThisPeriod = wonOpps.filter((o) => new Date(o.updatedAt) >= periodStart);
    const lostThisPeriod = lostOpps.filter((o) => new Date(o.updatedAt) >= periodStart);

    const totalPipelineValue = activeOpps.reduce((s, o) => s + o.value, 0);
    const avgDealSize =
      activeOpps.length > 0 ? Math.round(totalPipelineValue / activeOpps.length) : 0;

    // Stage distribution
    const stageDistribution: Record<string, { count: number; value: number }> = {};
    for (const opp of activeOpps) {
      if (!stageDistribution[opp.stage]) {
        stageDistribution[opp.stage] = { count: 0, value: 0 };
      }
      stageDistribution[opp.stage].count++;
      stageDistribution[opp.stage].value += opp.value;
    }

    // Win rate
    const closedThisPeriod = wonThisPeriod.length + lostThisPeriod.length;
    const winRate =
      closedThisPeriod > 0
        ? Math.round((wonThisPeriod.length / closedThisPeriod) * 100)
        : 0;

    // Average cycle time (days from creation to close for won deals this period)
    const cycleTimes = wonThisPeriod
      .map((o) => {
        const created = new Date(o.createdAt).getTime();
        const closed = new Date(o.updatedAt).getTime();
        return Math.round((closed - created) / (1000 * 60 * 60 * 24));
      })
      .filter((d) => d > 0);
    const avgCycleTime =
      cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : 0;

    // ── Lead metrics ─────────────────────────────────────────────────────

    const newLeadsThisPeriod = leads.filter((l) => new Date(l.createdAt) >= periodStart);
    const convertedThisPeriod = leads.filter(
      (l) => l.status === "CONVERTED" && new Date(l.updatedAt) >= periodStart
    );
    const disqualifiedThisPeriod = leads.filter(
      (l) => l.status === "DISQUALIFIED" && new Date(l.updatedAt) >= periodStart
    );
    const leadConversionRate =
      newLeadsThisPeriod.length > 0
        ? Math.round((convertedThisPeriod.length / newLeadsThisPeriod.length) * 100)
        : 0;

    // ── Activity metrics ─────────────────────────────────────────────────

    const activitiesThisPeriod = activities.filter(
      (a) => new Date(a.createdAt) >= periodStart
    );

    // Activities by type
    const activityByType: Record<string, number> = {};
    for (const a of activitiesThisPeriod) {
      activityByType[a.type] = (activityByType[a.type] || 0) + 1;
    }

    // Activities by rep
    const activityByRep: Record<string, { name: string; count: number }> = {};
    for (const a of activitiesThisPeriod) {
      if (a.creator) {
        if (!activityByRep[a.creator.id]) {
          activityByRep[a.creator.id] = { name: a.creator.name, count: 0 };
        }
        activityByRep[a.creator.id].count++;
      }
    }

    // ── Task metrics ─────────────────────────────────────────────────────

    const completedTasksThisPeriod = tasks.filter(
      (t) => t.status === "COMPLETED" && new Date(t.updatedAt) >= periodStart
    );
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate) < now
    );
    const tasksByPriority: Record<string, number> = {};
    for (const t of overdueTasks) {
      tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
    }

    // ── At-risk deals ────────────────────────────────────────────────────

    const atRiskDeals = activeOpps.filter((o) => {
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceUpdate > 14 || o.probability < 30;
    });
    const revenueAtRisk = atRiskDeals.reduce((s, o) => s + o.value, 0);

    // ── Key metrics object ───────────────────────────────────────────────

    const keyMetrics = {
      pipelineValue: totalPipelineValue,
      dealCount: activeOpps.length,
      avgDealSize,
      newLeads: newLeadsThisPeriod.length,
      convertedLeads: convertedThisPeriod.length,
      disqualifiedLeads: disqualifiedThisPeriod.length,
      leadConversionRate,
      dealsWon: wonThisPeriod.length,
      dealsLost: lostThisPeriod.length,
      winRate,
      avgCycleTime,
      totalActivities: activitiesThisPeriod.length,
      completedTasks: completedTasksThisPeriod.length,
      overdueTasks: overdueTasks.length,
      atRiskDeals: atRiskDeals.length,
      revenueAtRisk,
    };

    // ── Team performance ─────────────────────────────────────────────────

    const reps = users.filter((u) => ["SDR", "CLOSER", "USER"].includes(u.role));
    const teamPerformance: TeamPerformanceEntry[] = reps.map((rep) => {
      const repActivities = activitiesThisPeriod.filter(
        (a) => a.creator?.id === rep.id
      ).length;
      const repConversions = convertedThisPeriod.filter(
        (l) => l.owner?.id === rep.id
      ).length;

      // Simple trend: compare first half vs second half of period
      const midpoint = new Date(
        periodStart.getTime() + (now.getTime() - periodStart.getTime()) / 2
      );
      const firstHalf = activitiesThisPeriod.filter(
        (a) => a.creator?.id === rep.id && new Date(a.createdAt) < midpoint
      ).length;
      const secondHalf = activitiesThisPeriod.filter(
        (a) => a.creator?.id === rep.id && new Date(a.createdAt) >= midpoint
      ).length;

      const trend: "up" | "down" | "stable" =
        secondHalf > firstHalf * 1.1 ? "up" : secondHalf < firstHalf * 0.9 ? "down" : "stable";

      return {
        name: rep.name,
        activities: repActivities,
        conversions: repConversions,
        trend,
      };
    });

    // ── Generate highlights ──────────────────────────────────────────────

    const highlights: ReportHighlight[] = [];

    // Wins
    for (const won of wonThisPeriod.slice(0, 3)) {
      highlights.push({
        type: "win",
        text: `Won $${(won.value / 1000).toFixed(0)}K deal${won.account ? ` with ${won.account.name}` : ""}`,
      });
    }

    if (wonThisPeriod.length === 0 && closedThisPeriod > 0) {
      highlights.push({
        type: "concern",
        text: `No deals won in the ${periodLabel(period)} despite ${closedThisPeriod} deals closing`,
      });
    }

    // Concerns
    const stalledProposals = activeOpps.filter((o) => {
      if (o.stage !== "PROPOSAL") return false;
      const days = Math.floor(
        (now.getTime() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return days > 14;
    });
    if (stalledProposals.length > 0) {
      highlights.push({
        type: "concern",
        text: `${stalledProposals.length} deal${stalledProposals.length > 1 ? "s" : ""} stalled in Proposal stage >14 days`,
      });
    }

    if (overdueTasks.length > 3) {
      highlights.push({
        type: "concern",
        text: `${overdueTasks.length} overdue tasks need immediate attention`,
      });
    }

    if (atRiskDeals.length > 0) {
      highlights.push({
        type: "concern",
        text: `${atRiskDeals.length} at-risk deals with $${(revenueAtRisk / 1000).toFixed(0)}K in revenue at risk`,
      });
    }

    // Trends
    if (leadConversionRate > 0) {
      highlights.push({
        type: "trend",
        text: `Lead conversion rate at ${leadConversionRate}% for the ${periodLabel(period)}`,
      });
    }

    if (activitiesThisPeriod.length > 0) {
      highlights.push({
        type: "trend",
        text: `${activitiesThisPeriod.length} activities logged across ${Object.keys(activityByRep).length} rep${Object.keys(activityByRep).length !== 1 ? "s" : ""}`,
      });
    }

    // ── Generate recommendations ─────────────────────────────────────────

    const recommendations: ReportRecommendation[] = [];

    if (stalledProposals.length > 0) {
      recommendations.push({
        action: "Review stalled proposals",
        impact: "high",
        effort: "low",
        detail: `${stalledProposals.length} proposals have been inactive for 14+ days. Schedule follow-up calls this week to re-engage or disqualify.`,
      });
    }

    if (overdueTasks.length > 0) {
      recommendations.push({
        action: "Clear overdue task backlog",
        impact: "high",
        effort: "low",
        detail: `${overdueTasks.length} overdue tasks are creating follow-up gaps. Prioritize high-priority items and reschedule or close stale tasks.`,
      });
    }

    if (atRiskDeals.length > 2) {
      recommendations.push({
        action: "Conduct at-risk deal review",
        impact: "high",
        effort: "medium",
        detail: `$${(revenueAtRisk / 1000).toFixed(0)}K at risk across ${atRiskDeals.length} deals. Schedule a pipeline review to create recovery plans or reallocate resources.`,
      });
    }

    if (newLeadsThisPeriod.length > 0 && leadConversionRate < 20) {
      recommendations.push({
        action: "Improve lead qualification process",
        impact: "medium",
        effort: "medium",
        detail: `Conversion rate of ${leadConversionRate}% is below target. Review lead scoring criteria and ensure rapid first response to inbound leads.`,
      });
    }

    const lowActivityReps = teamPerformance.filter(
      (r) => r.activities < 5 && r.trend !== "up"
    );
    if (lowActivityReps.length > 0) {
      recommendations.push({
        action: "Coaching session for low-activity reps",
        impact: "medium",
        effort: "low",
        detail: `${lowActivityReps.length} rep${lowActivityReps.length > 1 ? "s" : ""} with fewer than 5 activities this period. Schedule 1:1 coaching to remove blockers and set activity targets.`,
      });
    }

    if (avgCycleTime > 45) {
      recommendations.push({
        action: "Optimize deal velocity",
        impact: "high",
        effort: "high",
        detail: `Average cycle time of ${avgCycleTime} days is above the 45-day threshold. Identify bottleneck stages and implement stage-specific acceleration playbooks.`,
      });
    }

    // ── AI narrative synthesis ────────────────────────────────────────────

    let executiveSummary = "";
    let provider: "openai" | "deterministic" = "deterministic";

    if (openaiTaskProvider.isConfigured()) {
      try {
        const prompt = buildAIPrompt(type, period, reportFormat, keyMetrics, highlights, recommendations, teamPerformance, stageDistribution);

        const result = await openaiTaskProvider.generateText(prompt, {
          systemInstruction:
            "You are a senior revenue operations analyst at a B2B SaaS company. Write executive reports that are analytical, specific, and actionable. No filler or generic advice.",
          maxTokens: reportFormat === "detailed" ? 1024 : 512,
          temperature: 0.3,
        });

        executiveSummary = result.text;
        provider = "openai";
      } catch (err) {
        console.warn("OpenAI report generation failed, using deterministic:", err);
        executiveSummary = buildDeterministicSummary(type, period, keyMetrics, highlights);
        provider = "deterministic";
      }
    } else {
      executiveSummary = buildDeterministicSummary(type, period, keyMetrics, highlights);
      provider = "deterministic";
    }

    // ── Response ─────────────────────────────────────────────────────────

    return sendSuccess({
      type,
      period,
      generatedAt: now.toISOString(),
      provider,
      report: {
        executiveSummary,
        keyMetrics,
        highlights,
        recommendations,
        teamPerformance,
        stageDistribution,
        activityByType,
      },
    });
  } catch (error: any) {
    console.error("POST /api/ai/generate-report error:", error);
    return sendUnhandledError();
  }
}

// ── Helper: Build AI prompt ──────────────────────────────────────────────

function buildAIPrompt(
  type: ReportType,
  period: ReportPeriod,
  format: ReportFormat,
  metrics: Record<string, number>,
  highlights: ReportHighlight[],
  recommendations: ReportRecommendation[],
  team: TeamPerformanceEntry[],
  stages: Record<string, { count: number; value: number }>
): string {
  const typeLabels: Record<ReportType, string> = {
    weekly_digest: "Weekly Digest",
    monthly_review: "Monthly Review",
    pipeline_analysis: "Pipeline Analysis",
    team_performance: "Team Performance Review",
    forecast_accuracy: "Forecast Accuracy Report",
  };

  return `Generate a ${typeLabels[type]} for the ${periodLabel(period)}.

${format === "detailed" ? "Provide a DETAILED report with thorough analysis." : "Provide a CONCISE executive summary (2-3 paragraphs max)."}

KEY METRICS:
- Pipeline: $${(metrics.pipelineValue / 1000).toFixed(0)}K across ${metrics.dealCount} active deals (avg $${(metrics.avgDealSize / 1000).toFixed(0)}K)
- New leads: ${metrics.newLeads} | Converted: ${metrics.convertedLeads} | Conversion rate: ${metrics.leadConversionRate}%
- Deals won: ${metrics.dealsWon} | Lost: ${metrics.dealsLost} | Win rate: ${metrics.winRate}%
- Average cycle time: ${metrics.avgCycleTime} days
- Total activities: ${metrics.totalActivities}
- Overdue tasks: ${metrics.overdueTasks}
- At-risk deals: ${metrics.atRiskDeals} ($${(metrics.revenueAtRisk / 1000).toFixed(0)}K at risk)

STAGE DISTRIBUTION:
${Object.entries(stages)
  .map(([stage, data]) => `- ${stage}: ${data.count} deals, $${(data.value / 1000).toFixed(0)}K`)
  .join("\n")}

HIGHLIGHTS:
${highlights.map((h) => `- [${h.type.toUpperCase()}] ${h.text}`).join("\n")}

TEAM:
${team.map((t) => `- ${t.name}: ${t.activities} activities, ${t.conversions} conversions, trending ${t.trend}`).join("\n")}

Write in professional English. Focus on:
1. Executive summary with 2-3 key takeaways
2. What's working well
3. Areas of concern and their business impact
4. Specific, actionable recommendations`;
}

// ── Helper: Build deterministic summary ──────────────────────────────────

function buildDeterministicSummary(
  type: ReportType,
  period: ReportPeriod,
  metrics: Record<string, number>,
  highlights: ReportHighlight[]
): string {
  const pLabel = periodLabel(period);
  const wins = highlights.filter((h) => h.type === "win");
  const concerns = highlights.filter((h) => h.type === "concern");

  const typeLabels: Record<ReportType, string> = {
    weekly_digest: "Weekly Digest",
    monthly_review: "Monthly Review",
    pipeline_analysis: "Pipeline Analysis",
    team_performance: "Team Performance Review",
    forecast_accuracy: "Forecast Accuracy Report",
  };

  let summary = `${typeLabels[type]} - ${pLabel.charAt(0).toUpperCase() + pLabel.slice(1)}\n\n`;

  // Pipeline overview
  summary += `Pipeline stands at $${(metrics.pipelineValue / 1000).toFixed(0)}K across ${metrics.dealCount} active deals with an average deal size of $${(metrics.avgDealSize / 1000).toFixed(0)}K. `;

  if (metrics.dealsWon > 0) {
    summary += `${metrics.dealsWon} deal${metrics.dealsWon > 1 ? "s" : ""} won this period with a ${metrics.winRate}% win rate. `;
  }

  if (metrics.avgCycleTime > 0) {
    summary += `Average sales cycle is ${metrics.avgCycleTime} days. `;
  }

  summary += "\n\n";

  // Lead activity
  summary += `${metrics.newLeads} new leads generated with a ${metrics.leadConversionRate}% conversion rate. ${metrics.totalActivities} activities logged across the team. `;

  if (metrics.overdueTasks > 0) {
    summary += `${metrics.overdueTasks} tasks are overdue and require immediate attention. `;
  }

  summary += "\n\n";

  // Risk assessment
  if (metrics.atRiskDeals > 0) {
    summary += `${metrics.atRiskDeals} deal${metrics.atRiskDeals > 1 ? "s" : ""} identified as at-risk with $${(metrics.revenueAtRisk / 1000).toFixed(0)}K in revenue exposure. `;
    summary += "Recommend immediate review and intervention to protect pipeline coverage.";
  } else {
    summary += "No significant pipeline risks identified this period.";
  }

  return summary;
}
