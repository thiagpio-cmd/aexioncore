import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { geminiProvider } from "@/lib/ai/providers/gemini-provider";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { actorFromSession, canPerform } from "@/lib/authorization";

/**
 * GET /api/ai/opportunity-insight?opportunityId=xxx
 *
 * Returns AI-powered coaching insight for a specific opportunity/deal.
 * Uses OpenAI / Gemini for LLM analysis when available, deterministic fallback otherwise.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const opportunityId = request.nextUrl.searchParams.get("opportunityId");
    if (!opportunityId) return sendError(badRequest("opportunityId is required"));

    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        owner: { select: { name: true } },
        account: {
          select: {
            name: true,
            company: { select: { name: true, industry: true } },
          },
        },
        primaryContact: { select: { name: true, email: true, title: true } },
      },
    });

    if (!opp) return sendError(notFound("Opportunity"));

    if (!canPerform(actor, "opportunity", "view", { ownerId: opp.ownerId, organizationId: opp.organizationId })) {
      return sendError(unauthorized());
    }

    // Get activity count and last activity
    const activities = await prisma.activity.findMany({
      where: { opportunityId, organizationId: opp.organizationId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, type: true },
      take: 50,
    });
    const activityCount = activities.length;
    const lastActivity = activities[0]?.createdAt || null;
    const lastActivityDays = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Get task counts
    const taskCount = await prisma.task.count({
      where: { opportunityId, organizationId: opp.organizationId },
    });

    const overdueTasks = await prisma.task.count({
      where: {
        opportunityId,
        organizationId: opp.organizationId,
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    });

    // Calculate stage duration
    const daysInStage = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceCreation = Math.floor((Date.now() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Stakeholder count (primary contact + owner)
    let stakeholderCount = 1; // owner always counts
    if (opp.primaryContact) stakeholderCount++;

    // --- Deterministic signals ---
    const signals: Array<{ type: "positive" | "negative" | "neutral"; text: string }> = [];

    if (opp.probability >= 70) signals.push({ type: "positive", text: `High win probability (${opp.probability}%)` });
    if (opp.probability < 30 && opp.probability > 0) signals.push({ type: "negative", text: `Low win probability (${opp.probability}%) — deal at risk` });
    if (opp.value >= 100000) signals.push({ type: "positive", text: `High-value deal ($${(opp.value / 1000).toFixed(0)}K)` });
    if (activityCount >= 5) signals.push({ type: "positive", text: `${activityCount} activities logged — active engagement` });
    if (activityCount === 0) signals.push({ type: "negative", text: "No activities recorded — engagement gap" });
    if (lastActivityDays !== null && lastActivityDays > 7) signals.push({ type: "negative", text: `${lastActivityDays} days since last activity — going stale` });
    if (lastActivityDays !== null && lastActivityDays <= 2) signals.push({ type: "positive", text: "Recently active — momentum is strong" });
    if (overdueTasks > 0) signals.push({ type: "negative", text: `${overdueTasks} overdue task(s) — follow-up needed` });
    if (daysInStage > 14) signals.push({ type: "negative", text: `${daysInStage} days in current stage — may be stuck` });
    if (opp.stage === "NEGOTIATION" && opp.probability >= 60) signals.push({ type: "positive", text: "In negotiation with strong probability — close is near" });
    if (!opp.primaryContact) signals.push({ type: "negative", text: "No primary contact linked — identify champion" });
    if (opp.expectedCloseDate) {
      const daysToExpectedClose = Math.floor((new Date(opp.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToExpectedClose < 0) signals.push({ type: "negative", text: `Expected close date passed ${Math.abs(daysToExpectedClose)} days ago` });
      else if (daysToExpectedClose <= 7) signals.push({ type: "neutral", text: `Close date in ${daysToExpectedClose} days — deadline approaching` });
    }

    // --- Risk analysis ---
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    const riskFactors: string[] = [];

    if (opp.probability < 30) { riskFactors.push("low_probability"); }
    if (lastActivityDays !== null && lastActivityDays > 7) { riskFactors.push("stale_engagement"); }
    if (daysInStage > 21) { riskFactors.push("stuck_in_stage"); }
    if (overdueTasks > 0) { riskFactors.push("overdue_tasks"); }
    if (!opp.primaryContact) { riskFactors.push("no_champion"); }
    if (opp.expectedCloseDate && new Date(opp.expectedCloseDate) < new Date()) { riskFactors.push("missed_deadline"); }

    if (riskFactors.length >= 4) riskLevel = "critical";
    else if (riskFactors.length >= 3) riskLevel = "high";
    else if (riskFactors.length >= 1) riskLevel = "medium";

    // Estimated days to close
    const stageDaysMap: Record<string, number> = {
      DISCOVERY: 30,
      QUALIFICATION: 20,
      PROPOSAL: 14,
      NEGOTIATION: 10,
      CLOSED_WON: 0,
      CLOSED_LOST: 0,
    };
    const estimatedDaysToClose = stageDaysMap[opp.stage] ?? 21;

    // --- Next best action ---
    let nextAction = "Review deal strategy and determine next steps";
    if (opp.stage === "DISCOVERY" && activityCount < 3) {
      nextAction = "Increase discovery engagement — schedule qualification call to uncover needs";
    } else if (opp.stage === "QUALIFICATION" && !opp.primaryContact) {
      nextAction = "Identify and link a primary contact / champion for this deal";
    } else if (opp.stage === "PROPOSAL" && lastActivityDays !== null && lastActivityDays > 5) {
      nextAction = "Follow up on proposal — re-engage before momentum is lost";
    } else if (opp.stage === "NEGOTIATION") {
      nextAction = "Push for close — address remaining objections and finalize terms";
    } else if (overdueTasks > 0) {
      nextAction = "Complete overdue tasks to maintain deal momentum";
    } else if (lastActivityDays !== null && lastActivityDays > 7) {
      nextAction = "Re-engage stakeholders — deal is going stale";
    } else if (opp.probability < 40 && opp.value >= 50000) {
      nextAction = "High-value deal with low probability — revisit deal strategy with manager";
    }

    // --- Recent AI actions (from activity log) ---
    const recentAIActivities = await prisma.activity.findMany({
      where: {
        opportunityId,
        organizationId: opp.organizationId,
        creatorId: "system",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { subject: true, createdAt: true },
      take: 5,
    });

    const recentAIActions = recentAIActivities.map((a) => ({
      action: a.subject || "System action",
      timestamp: a.createdAt.toISOString(),
    }));

    // --- LLM enrichment ---
    let aiInsight: string | null = null;
    let provider = "deterministic";

    const insightPrompt = `You are a senior deal strategist. Provide a 2-3 sentence coaching insight for this deal.

Deal: ${opp.title}
Account: ${opp.account?.name || "Unknown"} (Industry: ${opp.account?.company?.industry || "Unknown"})
Stage: ${opp.stage}, Probability: ${opp.probability}%, Value: $${opp.value}
Owner: ${opp.owner?.name || "Unknown"}
Primary Contact: ${opp.primaryContact?.name || "None"} (${opp.primaryContact?.title || "Unknown title"})
Days in stage: ${daysInStage}, Days since creation: ${daysSinceCreation}
Last activity: ${lastActivityDays !== null ? `${lastActivityDays} days ago` : "None"}
Activities: ${activityCount}, Tasks: ${taskCount} (${overdueTasks} overdue)
Risk factors: ${riskFactors.length > 0 ? riskFactors.join(", ") : "none identified"}
${opp.expectedCloseDate ? `Expected close: ${new Date(opp.expectedCloseDate).toISOString().split("T")[0]}` : "No expected close date"}

Focus on: What is the single most impactful action to advance this deal RIGHT NOW, and why?
Be specific and actionable. No generic advice.`;

    // Try OpenAI first
    if (openaiTaskProvider.isConfigured()) {
      try {
        const result = await openaiTaskProvider.generateText(insightPrompt, {
          maxTokens: 256,
          temperature: 0.3,
          systemInstruction: "You are a revenue operations deal coach. Be direct, specific, and actionable.",
        });
        aiInsight = result.text;
        provider = "openai";
      } catch (err) {
        console.warn("OpenAI opportunity insight failed:", err);
      }
    }

    // Fall back to Gemini
    if (!aiInsight && geminiProvider.isConfigured()) {
      try {
        const result = await geminiProvider.generateText(insightPrompt, {
          maxTokens: 256,
          temperature: 0.3,
          systemInstruction: "You are a revenue operations deal coach. Be direct, specific, and actionable.",
        });
        aiInsight = result.text;
        provider = "gemini";
      } catch (err) {
        console.warn("Gemini opportunity insight failed:", err);
      }
    }

    return sendSuccess({
      signals,
      nextAction,
      aiInsight,
      provider,
      riskAnalysis: {
        level: riskLevel,
        factors: riskFactors,
        winProbability: opp.probability,
        daysToClose: estimatedDaysToClose,
      },
      recentAIActions,
      context: {
        daysInStage,
        activityCount,
        lastActivityDays,
        stakeholderCount,
        taskCount,
        overdueTasks,
        daysSinceCreation,
      },
    });
  } catch (error: any) {
    console.error("GET /api/ai/opportunity-insight error:", error);
    return sendUnhandledError();
  }
}
