import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiskFactor {
  name: string;
  score: number;
  status: "good" | "warning" | "critical";
  detail: string;
  recommendation: string;
}

interface Forecast {
  predictedCloseDate: string | null;
  winProbability: number;
  expectedValue: number;
  revenueAtRisk: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STAGE_AVG_DAYS: Record<string, number> = {
  DISCOVERY: 14,
  QUALIFICATION: 12,
  PROPOSAL: 10,
  NEGOTIATION: 8,
  CLOSED_WON: 0,
  CLOSED_LOST: 0,
};

const STAGE_REMAINING_DAYS: Record<string, number> = {
  DISCOVERY: 44,
  QUALIFICATION: 30,
  PROPOSAL: 18,
  NEGOTIATION: 8,
  CLOSED_WON: 0,
  CLOSED_LOST: 0,
};

const COMPETITOR_KEYWORDS = [
  "competitor", "alternative", "versus", "compared to", "instead of",
  "other option", "salesforce", "hubspot", "pipedrive", "zoho",
  "evaluating", "shortlist", "benchmark", "rival",
];

const BUDGET_CONCERN_KEYWORDS = [
  "expensive", "budget", "cost", "pricing", "discount", "too much",
  "afford", "cheaper", "over budget", "reduce price", "payment terms",
  "ROI", "justify", "approval", "procurement",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): "good" | "warning" | "critical" {
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function searchTextForKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * GET /api/ai/deal-risk?opportunityId=xxx
 *
 * Deep deal risk analysis with 7 risk factors, forecast, and optional AI narrative.
 * Deterministic scoring with OpenAI narrative enrichment.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const opportunityId = request.nextUrl.searchParams.get("opportunityId");
    if (!opportunityId) return sendError(badRequest("opportunityId is required"));

    // ─── Fetch opportunity with relations ───────────────────────────────
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        owner: { select: { id: true, name: true } },
        account: {
          select: {
            id: true,
            name: true,
            company: { select: { name: true, industry: true } },
          },
        },
        primaryContact: {
          select: { id: true, name: true, email: true, title: true, isChampion: true, isDecisionMaker: true },
        },
        tasks: {
          select: { id: true, status: true, dueDate: true },
        },
      },
    });

    if (!opp) return sendError(notFound("Opportunity"));

    if (!canPerform(actor, "opportunity", "view", { ownerId: opp.ownerId, organizationId: opp.organizationId })) {
      return sendError(unauthorized());
    }

    // ─── Gather data ────────────────────────────────────────────────────

    // All activities for this opportunity
    const activities = await prisma.activity.findMany({
      where: { opportunityId, organizationId: opp.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, type: true, subject: true, body: true, creatorId: true },
      take: 100,
    });

    // Contacts engaged via activities (unique creators)
    const uniqueCreators = new Set(activities.map((a) => a.creatorId).filter(Boolean));

    // Inbox messages linked to this opportunity
    const inboxMessages = await prisma.inboxMessage.findMany({
      where: { opportunityId, organizationId: opp.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, subject: true, createdAt: true, sender: true },
      take: 50,
    });

    // Meetings for this opportunity
    const meetings = await prisma.meeting.findMany({
      where: { opportunityId, organizationId: opp.organizationId },
      orderBy: { startTime: "desc" },
      select: { id: true, startTime: true, attendees: true, notes: true },
      take: 20,
    });

    // All contacts for this account's company (to assess stakeholder coverage)
    let companyContacts: { id: string; title: string | null; isDecisionMaker: boolean; isChampion: boolean }[] = [];
    if (opp.account?.company) {
      companyContacts = await prisma.contact.findMany({
        where: {
          company: { name: opp.account.company.name },
        },
        select: { id: true, title: true, isDecisionMaker: true, isChampion: true },
        take: 50,
      });
    }

    // ─── Computed values ────────────────────────────────────────────────

    const now = Date.now();
    const daysInStage = Math.floor((now - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceCreation = Math.floor((now - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const avgStageDays = STAGE_AVG_DAYS[opp.stage] ?? 14;

    const lastActivity = activities[0]?.createdAt || null;
    const lastActivityDays = lastActivity
      ? Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const overdueTasks = (opp.tasks || []).filter(
      (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < new Date()
    ).length;

    // Activity frequency: activities per week over last 4 weeks
    const fourWeeksAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);
    const recentActivities = activities.filter((a) => new Date(a.createdAt) >= fourWeeksAgo);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const firstHalf = recentActivities.filter((a) => new Date(a.createdAt) < twoWeeksAgo);
    const secondHalf = recentActivities.filter((a) => new Date(a.createdAt) >= twoWeeksAgo);

    // Combine all text for keyword scanning
    const allText = [
      ...activities.map((a) => `${a.subject || ""} ${a.body || ""}`),
      ...inboxMessages.map((m) => `${m.subject || ""} ${m.body || ""}`),
      ...meetings.map((m) => m.notes || ""),
    ].join(" ");

    // ─── Factor 1: Stage Velocity ───────────────────────────────────────

    let stageVelocityScore: number;
    let stageVelocityDetail: string;
    let stageVelocityRec: string;

    if (["CLOSED_WON", "CLOSED_LOST"].includes(opp.stage)) {
      stageVelocityScore = 100;
      stageVelocityDetail = "Deal is closed";
      stageVelocityRec = "No action needed";
    } else {
      const ratio = daysInStage / avgStageDays;
      if (ratio <= 0.8) {
        stageVelocityScore = 95;
        stageVelocityDetail = `On track: ${daysInStage} days in ${opp.stage} (avg ${avgStageDays} days)`;
        stageVelocityRec = "Maintain current momentum";
      } else if (ratio <= 1.2) {
        stageVelocityScore = 75;
        stageVelocityDetail = `Approaching average: ${daysInStage} days in ${opp.stage} (avg ${avgStageDays} days)`;
        stageVelocityRec = "Push for stage advancement this week";
      } else if (ratio <= 2.0) {
        stageVelocityScore = 50;
        stageVelocityDetail = `Slowing: ${daysInStage} days in ${opp.stage} (avg is ${avgStageDays} days)`;
        stageVelocityRec = "Schedule a decision meeting within 48h";
      } else {
        stageVelocityScore = clamp(30 - (ratio - 2) * 10);
        stageVelocityDetail = `Stuck: ${daysInStage} days in ${opp.stage} (avg is ${avgStageDays} days)`;
        stageVelocityRec = "Escalate internally and re-qualify the deal";
      }
    }

    const stageVelocity: RiskFactor = {
      name: "Stage Velocity",
      score: clamp(stageVelocityScore),
      status: statusFromScore(stageVelocityScore),
      detail: stageVelocityDetail,
      recommendation: stageVelocityRec,
    };

    // ─── Factor 2: Engagement ───────────────────────────────────────────

    let engagementScore: number;
    let engagementDetail: string;
    let engagementRec: string;

    const totalRecentActivities = recentActivities.length;
    const isDecaying = firstHalf.length > 0 && secondHalf.length < firstHalf.length * 0.5;

    if (totalRecentActivities === 0 && lastActivityDays !== null && lastActivityDays > 14) {
      engagementScore = 15;
      engagementDetail = `No activity in ${lastActivityDays} days - deal may be abandoned`;
      engagementRec = "Immediate re-engagement needed: call or visit the account";
    } else if (totalRecentActivities === 0) {
      engagementScore = 30;
      engagementDetail = "No recent activities recorded";
      engagementRec = "Start a cadence of regular touch-points";
    } else if (isDecaying) {
      engagementScore = 45;
      engagementDetail = `Activity declining: ${firstHalf.length} activities (weeks 3-4 ago) vs ${secondHalf.length} (last 2 weeks)`;
      engagementRec = "Increase engagement frequency to prevent deal from stalling";
    } else if (lastActivityDays !== null && lastActivityDays <= 2) {
      engagementScore = 95;
      engagementDetail = `Strong engagement: ${totalRecentActivities} activities in 4 weeks, last activity ${lastActivityDays} day(s) ago`;
      engagementRec = "Maintain current cadence";
    } else if (lastActivityDays !== null && lastActivityDays <= 7) {
      engagementScore = 80;
      engagementDetail = `Good engagement: ${totalRecentActivities} activities in 4 weeks, last activity ${lastActivityDays} days ago`;
      engagementRec = "Continue regular follow-ups";
    } else {
      engagementScore = 60;
      engagementDetail = `Moderate engagement: last activity ${lastActivityDays ?? "unknown"} days ago`;
      engagementRec = "Schedule a check-in within the next 2 days";
    }

    const engagement: RiskFactor = {
      name: "Engagement",
      score: clamp(engagementScore),
      status: statusFromScore(engagementScore),
      detail: engagementDetail,
      recommendation: engagementRec,
    };

    // ─── Factor 3: Stakeholder Coverage ─────────────────────────────────

    let stakeholderScore: number;
    let stakeholderDetail: string;
    let stakeholderRec: string;

    const totalContacts = companyContacts.length;
    const hasDecisionMaker = companyContacts.some((c) => c.isDecisionMaker);
    const hasChampion = opp.primaryContact?.isChampion || companyContacts.some((c) => c.isChampion);
    const engagedContactCount = uniqueCreators.size + (opp.primaryContact ? 1 : 0);

    if (!opp.primaryContact) {
      stakeholderScore = 25;
      stakeholderDetail = "No primary contact linked to this deal";
      stakeholderRec = "Identify and link a champion for this opportunity";
    } else if (!hasDecisionMaker && !hasChampion) {
      stakeholderScore = 40;
      stakeholderDetail = `${engagedContactCount} contact(s) engaged but no decision-maker or champion identified`;
      stakeholderRec = "Map the buying committee and identify the economic buyer";
    } else if (!hasDecisionMaker) {
      stakeholderScore = 60;
      stakeholderDetail = `Champion identified but no decision-maker mapped (${engagedContactCount} contacts engaged)`;
      stakeholderRec = "Get introduced to the decision-maker through your champion";
    } else if (engagedContactCount >= 3) {
      stakeholderScore = 95;
      stakeholderDetail = `Strong coverage: ${engagedContactCount} contacts engaged, decision-maker and champion identified`;
      stakeholderRec = "Maintain multi-threaded engagement";
    } else {
      stakeholderScore = 75;
      stakeholderDetail = `${engagedContactCount} contact(s) engaged with decision-maker identified`;
      stakeholderRec = "Expand engagement to additional stakeholders to reduce single-thread risk";
    }

    const stakeholderCoverage: RiskFactor = {
      name: "Stakeholder Coverage",
      score: clamp(stakeholderScore),
      status: statusFromScore(stakeholderScore),
      detail: stakeholderDetail,
      recommendation: stakeholderRec,
    };

    // ─── Factor 4: Competitive Threat ───────────────────────────────────

    let competitiveScore: number;
    let competitiveDetail: string;
    let competitiveRec: string;

    const competitorMentions = searchTextForKeywords(allText, COMPETITOR_KEYWORDS);

    if (competitorMentions.length === 0) {
      competitiveScore = 90;
      competitiveDetail = "No competitor mentions detected in communications";
      competitiveRec = "Proactively ask about alternatives being evaluated";
    } else if (competitorMentions.length <= 2) {
      competitiveScore = 60;
      competitiveDetail = `Competitor signals detected: "${competitorMentions.slice(0, 2).join('", "')}" mentioned in communications`;
      competitiveRec = "Prepare competitive battle card and emphasize unique differentiators";
    } else {
      competitiveScore = 35;
      competitiveDetail = `Heavy competitive activity: ${competitorMentions.length} competitor-related mentions found`;
      competitiveRec = "Urgent: schedule competitive review and prepare win strategy";
    }

    const competitiveThreat: RiskFactor = {
      name: "Competitive Threat",
      score: clamp(competitiveScore),
      status: statusFromScore(competitiveScore),
      detail: competitiveDetail,
      recommendation: competitiveRec,
    };

    // ─── Factor 5: Budget Signals ───────────────────────────────────────

    let budgetScore: number;
    let budgetDetail: string;
    let budgetRec: string;

    const budgetMentions = searchTextForKeywords(allText, BUDGET_CONCERN_KEYWORDS);

    if (budgetMentions.length === 0) {
      budgetScore = 90;
      budgetDetail = "No pricing objections or budget concerns detected";
      budgetRec = "Continue to build value before discussing pricing";
    } else if (budgetMentions.length <= 2) {
      budgetScore = 65;
      budgetDetail = `Budget signals detected: "${budgetMentions.slice(0, 2).join('", "')}" mentioned`;
      budgetRec = "Prepare ROI analysis and value justification materials";
    } else {
      budgetScore = 35;
      budgetDetail = `Significant budget concerns: ${budgetMentions.length} pricing/budget mentions found`;
      budgetRec = "Schedule pricing review call and explore flexible payment terms";
    }

    const budgetSignals: RiskFactor = {
      name: "Budget Signals",
      score: clamp(budgetScore),
      status: statusFromScore(budgetScore),
      detail: budgetDetail,
      recommendation: budgetRec,
    };

    // ─── Factor 6: Champion Health ──────────────────────────────────────

    let championScore: number;
    let championDetail: string;
    let championRec: string;

    if (!opp.primaryContact) {
      championScore = 20;
      championDetail = "No champion identified for this deal";
      championRec = "Identify an internal advocate who supports your solution";
    } else {
      // Check if primary contact has recent activity
      const championActivities = activities.filter(
        (a) => a.creatorId === opp.primaryContact?.id || a.subject?.includes(opp.primaryContact?.name || "---never---")
      );
      const lastChampionActivity = championActivities[0]?.createdAt;
      const championDaysSilent = lastChampionActivity
        ? Math.floor((now - new Date(lastChampionActivity).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (championDaysSilent !== null && championDaysSilent <= 7) {
        championScore = 90;
        championDetail = `Champion (${opp.primaryContact.name}) active: last interaction ${championDaysSilent} day(s) ago`;
        championRec = "Keep champion engaged and aligned on next steps";
      } else if (championDaysSilent !== null && championDaysSilent <= 14) {
        championScore = 65;
        championDetail = `Champion (${opp.primaryContact.name}) quiet: ${championDaysSilent} days since last interaction`;
        championRec = "Reach out to your champion to confirm deal status and internal support";
      } else if (lastActivity) {
        // There is activity but not from champion specifically
        championScore = 50;
        championDetail = `Champion (${opp.primaryContact.name}) not directly active, but other engagement exists`;
        championRec = "Re-engage your champion directly to ensure internal advocacy continues";
      } else {
        championScore = 30;
        championDetail = `Champion (${opp.primaryContact.name}) has no recorded interactions`;
        championRec = "Validate champion relationship and schedule a 1-on-1 check-in";
      }
    }

    const championHealth: RiskFactor = {
      name: "Champion Health",
      score: clamp(championScore),
      status: statusFromScore(championScore),
      detail: championDetail,
      recommendation: championRec,
    };

    // ─── Factor 7: Timeline Risk ────────────────────────────────────────

    let timelineScore: number;
    let timelineDetail: string;
    let timelineRec: string;

    const remainingDays = STAGE_REMAINING_DAYS[opp.stage] ?? 21;

    if (["CLOSED_WON", "CLOSED_LOST"].includes(opp.stage)) {
      timelineScore = 100;
      timelineDetail = "Deal is closed";
      timelineRec = "No action needed";
    } else if (!opp.expectedCloseDate) {
      timelineScore = 50;
      timelineDetail = "No expected close date set";
      timelineRec = "Set a realistic close date to track deal velocity";
    } else {
      const daysToClose = Math.floor(
        (new Date(opp.expectedCloseDate).getTime() - now) / (1000 * 60 * 60 * 24)
      );

      if (daysToClose < 0) {
        timelineScore = 15;
        timelineDetail = `Close date passed ${Math.abs(daysToClose)} days ago and deal is still in ${opp.stage}`;
        timelineRec = "Update close date or re-qualify the deal immediately";
      } else if (daysToClose < remainingDays * 0.3) {
        timelineScore = 35;
        timelineDetail = `Only ${daysToClose} days until close date but still in ${opp.stage} (typically needs ${remainingDays}+ days from here)`;
        timelineRec = "Close date may be unrealistic - consider updating or accelerating deal";
      } else if (daysToClose < remainingDays) {
        timelineScore = 65;
        timelineDetail = `${daysToClose} days until close date, ${opp.stage} typically takes ${remainingDays} more days`;
        timelineRec = "Keep pace to meet the close date - avoid delays";
      } else {
        timelineScore = 90;
        timelineDetail = `${daysToClose} days until close date - timeline is healthy for ${opp.stage}`;
        timelineRec = "Timeline is on track, maintain deal velocity";
      }
    }

    const timelineRisk: RiskFactor = {
      name: "Timeline Risk",
      score: clamp(timelineScore),
      status: statusFromScore(timelineScore),
      detail: timelineDetail,
      recommendation: timelineRec,
    };

    // ─── Overall Score ──────────────────────────────────────────────────

    const factors: RiskFactor[] = [
      stageVelocity,
      engagement,
      stakeholderCoverage,
      competitiveThreat,
      budgetSignals,
      championHealth,
      timelineRisk,
    ];

    // Weighted average: stage velocity and engagement are most impactful
    const weights = [0.18, 0.18, 0.15, 0.12, 0.12, 0.13, 0.12];
    const overallScore = Math.round(
      factors.reduce((sum, f, i) => sum + f.score * weights[i], 0)
    );

    let overallRisk: "low" | "medium" | "high" | "critical";
    if (overallScore >= 75) overallRisk = "low";
    else if (overallScore >= 55) overallRisk = "medium";
    else if (overallScore >= 35) overallRisk = "high";
    else overallRisk = "critical";

    // ─── Forecast ───────────────────────────────────────────────────────

    const winProbability = clamp(
      Math.round(overallScore * 0.6 + opp.probability * 0.4)
    );
    const expectedValue = Math.round(opp.value * (winProbability / 100));
    const revenueAtRisk = opp.value - expectedValue;

    let predictedCloseDate: string | null = null;
    if (!["CLOSED_WON", "CLOSED_LOST"].includes(opp.stage)) {
      const predicted = new Date(now + remainingDays * 24 * 60 * 60 * 1000);
      predictedCloseDate = predicted.toISOString().split("T")[0];
    }

    const forecast: Forecast = {
      predictedCloseDate,
      winProbability,
      expectedValue,
      revenueAtRisk,
    };

    // ─── AI Narrative ───────────────────────────────────────────────────

    let aiNarrative: string | null = null;
    let provider: "openai" | "deterministic" = "deterministic";

    if (openaiTaskProvider.isConfigured()) {
      try {
        const narrativePrompt = `You are a senior deal strategist. Analyze this deal risk profile and write a concise 3-4 sentence narrative summary.

Deal: ${opp.title}
Account: ${opp.account?.name || "Unknown"} (${opp.account?.company?.industry || "Unknown industry"})
Stage: ${opp.stage}, Value: $${opp.value.toLocaleString()}, Probability: ${opp.probability}%
Days in stage: ${daysInStage}, Days since creation: ${daysSinceCreation}
Overall risk score: ${overallScore}/100 (${overallRisk})

Risk factors:
${factors.map((f) => `- ${f.name}: ${f.score}/100 (${f.status}) - ${f.detail}`).join("\n")}

Forecast: Win probability ${winProbability}%, Revenue at risk: $${revenueAtRisk.toLocaleString()}

Write a strategic narrative that:
1. Identifies the single biggest risk to this deal
2. Explains the impact if not addressed
3. Recommends a specific action plan
Be direct and specific. No generic advice.`;

        const result = await openaiTaskProvider.generateText(narrativePrompt, {
          maxTokens: 300,
          temperature: 0.3,
          systemInstruction: "You are a revenue operations deal risk analyst. Be analytical, precise, and actionable.",
        });
        aiNarrative = result.text;
        provider = "openai";
      } catch (err) {
        console.warn("[deal-risk] OpenAI narrative failed:", err);
      }
    }

    // Fallback deterministic narrative
    if (!aiNarrative) {
      const worstFactor = [...factors].sort((a, b) => a.score - b.score)[0];
      const secondWorst = [...factors].sort((a, b) => a.score - b.score)[1];

      aiNarrative =
        `This deal shows ${overallRisk} risk with an overall score of ${overallScore}/100. ` +
        `The primary concern is ${worstFactor.name.toLowerCase()} (${worstFactor.score}/100): ${worstFactor.detail.toLowerCase()}. ` +
        (secondWorst.score < 70
          ? `Additionally, ${secondWorst.name.toLowerCase()} (${secondWorst.score}/100) requires attention. `
          : "") +
        `Recommended action: ${worstFactor.recommendation}.`;
    }

    // ─── Response ───────────────────────────────────────────────────────

    return sendSuccess({
      overallRisk,
      overallScore,
      factors,
      aiNarrative,
      provider,
      forecast,
    });
  } catch (error: any) {
    console.error("GET /api/ai/deal-risk error:", error);
    return sendUnhandledError();
  }
}
