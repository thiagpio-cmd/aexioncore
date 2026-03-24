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
 * GET /api/ai/lead-insight?leadId=xxx
 *
 * Returns AI-powered insight for a specific lead.
 * Uses Gemini for LLM analysis when available, deterministic fallback otherwise.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const leadId = request.nextUrl.searchParams.get("leadId");
    if (!leadId) return sendError(badRequest("leadId is required"));

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        owner: { select: { name: true } },
        company: { select: { name: true, website: true } },
        contact: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!lead) return sendError(notFound("Lead"));

    if (!canPerform(actor, "lead", "view", { ownerId: lead.ownerId, organizationId: lead.organizationId })) {
      return sendError(unauthorized());
    }

    // Get activity count
    const activityCount = await prisma.activity.count({
      where: { leadId, organizationId: lead.organizationId },
    });

    // Get task count
    const taskCount = await prisma.task.count({
      where: { leadId, organizationId: lead.organizationId },
    });

    const overdueTasks = await prisma.task.count({
      where: {
        leadId,
        organizationId: lead.organizationId,
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    });

    // Calculate days since creation and last contact
    const daysSinceCreation = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceContact = lead.lastContact
      ? Math.floor((Date.now() - new Date(lead.lastContact).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Deterministic analysis (always available)
    const signals: Array<{ type: "positive" | "negative" | "neutral"; text: string }> = [];

    if (lead.temperature === "HOT") signals.push({ type: "positive", text: "Lead is HOT — high engagement signals" });
    if (lead.temperature === "COLD") signals.push({ type: "negative", text: "Lead is COLD — may need nurture sequence" });
    if (lead.fitScore >= 70) signals.push({ type: "positive", text: `High fit score (${lead.fitScore}/100)` });
    if (lead.fitScore < 40 && lead.fitScore > 0) signals.push({ type: "negative", text: `Low fit score (${lead.fitScore}/100)` });
    if (activityCount >= 5) signals.push({ type: "positive", text: `${activityCount} activities logged — active engagement` });
    if (activityCount === 0) signals.push({ type: "negative", text: "No activities recorded — engagement gap" });
    if (overdueTasks > 0) signals.push({ type: "negative", text: `${overdueTasks} overdue task(s) — follow-up needed` });
    if (daysSinceContact && daysSinceContact > 7) signals.push({ type: "negative", text: `${daysSinceContact} days since last contact — going stale` });
    if (daysSinceContact && daysSinceContact <= 2) signals.push({ type: "positive", text: "Recently contacted — momentum is strong" });
    if (lead.source === "referral" || lead.source === "REFERRAL") signals.push({ type: "positive", text: "Referral source — highest conversion channel" });

    // Determine next best action
    let nextAction = "Review lead data and determine next step";
    if (lead.status === "NEW" && !lead.lastContact) {
      nextAction = "Make initial contact — first touch within 24h is critical";
    } else if (lead.temperature === "HOT" && lead.status !== "CONVERTED") {
      nextAction = "Schedule qualification call — this lead is ready to move";
    } else if (daysSinceContact && daysSinceContact > 5) {
      nextAction = "Re-engage with personalized outreach before lead goes cold";
    } else if (overdueTasks > 0) {
      nextAction = "Complete overdue tasks to maintain lead momentum";
    } else if (lead.status === "QUALIFIED") {
      nextAction = "Prepare proposal and convert to opportunity";
    }

    // LLM enrichment (optional)
    let aiInsight: string | null = null;
    let provider = "deterministic";

    const insightData = {
      name: lead.name,
      company: lead.company?.name || "Unknown",
      title: lead.title || "Unknown",
      status: lead.status,
      temperature: lead.temperature,
      fitScore: lead.fitScore,
      source: lead.source,
      daysSinceCreation,
      daysSinceContact,
      activityCount,
      taskCount,
      overdueTasks,
    };

    // Try OpenAI first
    if (openaiTaskProvider.isConfigured()) {
      try {
        aiInsight = await openaiTaskProvider.generateLeadInsight(insightData);
        provider = "openai";
      } catch (err) {
        console.warn("OpenAI lead insight failed:", err);
      }
    }

    // Fall back to Gemini
    if (!aiInsight && geminiProvider.isConfigured()) {
      try {
        const result = await geminiProvider.generateText(
          `You are a senior sales operations analyst. Provide a 2-3 sentence strategic insight for this lead.

Lead: ${insightData.name}, Company: ${insightData.company}, Title: ${insightData.title}
Status: ${insightData.status}, Temperature: ${insightData.temperature}, Fit Score: ${insightData.fitScore}/100
Source: ${insightData.source}, Days since creation: ${insightData.daysSinceCreation}
Days since last contact: ${insightData.daysSinceContact ?? "Never contacted"}
Activities: ${insightData.activityCount}, Tasks: ${insightData.taskCount} (${insightData.overdueTasks} overdue)

Focus on: What is the single most impactful action the rep should take RIGHT NOW, and why?`,
          { maxTokens: 256, temperature: 0.3, systemInstruction: "You are a revenue operations analyst. Be direct, specific, and actionable." }
        );
        aiInsight = result.text;
        provider = "gemini";
      } catch (err) {
        console.warn("Gemini lead insight failed:", err);
      }
    }

    return sendSuccess({
      signals,
      nextAction,
      aiInsight,
      provider,
      context: {
        daysSinceCreation,
        daysSinceContact,
        activityCount,
        taskCount,
        overdueTasks,
      },
    });
  } catch (error: any) {
    console.error("GET /api/ai/lead-insight error:", error);
    return sendUnhandledError();
  }
}
