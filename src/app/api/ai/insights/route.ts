import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { geminiProvider } from "@/lib/ai/providers/gemini-provider";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

/**
 * GET /api/ai/insights
 *
 * Returns AI-generated executive insights for the dashboard.
 * Uses Gemini for LLM synthesis when available, falls back to deterministic analysis.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const roleError = requireRole(session.user as any, "SDR");
    if (roleError) return roleError;

    const orgId = session.user.organizationId;
    const now = new Date();

    // Gather metrics for AI context
    const [opportunities, leads, tasks] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: orgId },
        select: { value: true, stage: true, probability: true, updatedAt: true },
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId },
        select: { status: true, temperature: true, createdAt: true, lastContact: true },
      }),
      prisma.task.findMany({
        where: { organizationId: orgId },
        select: { status: true, dueDate: true, priority: true },
      }),
    ]);

    const activeOpps = opportunities.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
    const wonOpps = opportunities.filter((o) => o.stage === "CLOSED_WON");
    const lostOpps = opportunities.filter((o) => o.stage === "CLOSED_LOST");
    const totalPipeline = activeOpps.reduce((s, o) => s + o.value, 0);
    const wonValue = wonOpps.reduce((s, o) => s + o.value, 0);
    const closedCount = wonOpps.length + lostOpps.length;
    const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
    const hotLeads = leads.filter((l) => l.temperature === "HOT").length;
    const convertedLeads = leads.filter((l) => l.status === "CONVERTED").length;
    const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

    const overdueTasks = tasks.filter((t) => t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate) < now).length;
    const staleLeads = leads.filter((l) => {
      if (!l.lastContact) return l.status === "NEW";
      return (now.getTime() - new Date(l.lastContact).getTime()) > 7 * 24 * 60 * 60 * 1000;
    }).length;

    // Deterministic insights (always available)
    const deterministicInsights: Array<{
      type: "success" | "warning" | "danger" | "info";
      title: string;
      description: string;
      metric?: string;
    }> = [];

    if (winRate >= 30) {
      deterministicInsights.push({
        type: "success",
        title: "Strong Win Rate",
        description: `Your ${winRate}% win rate is above industry average. Keep qualifying rigorously.`,
        metric: `${winRate}%`,
      });
    } else if (closedCount > 0) {
      deterministicInsights.push({
        type: "warning",
        title: "Win Rate Below Target",
        description: `${winRate}% win rate needs attention. Review lost deals for patterns.`,
        metric: `${winRate}%`,
      });
    }

    if (hotLeads > 0) {
      deterministicInsights.push({
        type: "info",
        title: "Hot Leads Ready",
        description: `${hotLeads} hot lead${hotLeads > 1 ? "s" : ""} ready for conversion. Prioritize immediate outreach.`,
        metric: `${hotLeads}`,
      });
    }

    if (overdueTasks > 0) {
      deterministicInsights.push({
        type: "danger",
        title: "Overdue Tasks",
        description: `${overdueTasks} task${overdueTasks > 1 ? "s" : ""} past due. Overdue follow-ups directly impact conversion rates.`,
        metric: `${overdueTasks}`,
      });
    }

    if (staleLeads > 3) {
      deterministicInsights.push({
        type: "warning",
        title: "Stale Leads Accumulating",
        description: `${staleLeads} leads with no contact in 7+ days. Consider reassignment or nurture sequence.`,
        metric: `${staleLeads}`,
      });
    }

    if (totalPipeline > 0 && activeOpps.length > 0) {
      const avgDeal = Math.round(totalPipeline / activeOpps.length);
      deterministicInsights.push({
        type: "info",
        title: "Pipeline Health",
        description: `$${(totalPipeline / 1000).toFixed(0)}K across ${activeOpps.length} deals. Average deal size: $${(avgDeal / 1000).toFixed(0)}K.`,
        metric: `$${(totalPipeline / 1000).toFixed(0)}K`,
      });
    }

    // LLM synthesis — try OpenAI first, then Gemini, then deterministic
    let aiSynthesis: string | null = null;
    let aiProvider: string = "none";

    const synthesisData = {
      pipeline: { totalValue: totalPipeline, dealCount: activeOpps.length, winRate },
      leads: { total: leads.length, conversionRate, hotCount: hotLeads },
      alerts: { critical: overdueTasks, warning: staleLeads },
      period: "Current Quarter",
    };

    if (openaiTaskProvider.isConfigured()) {
      try {
        aiSynthesis = await openaiTaskProvider.synthesizeExecutive(synthesisData);
        aiProvider = "openai";
      } catch (err) {
        console.warn("OpenAI synthesis failed:", err);
      }
    }

    if (!aiSynthesis && geminiProvider.isConfigured()) {
      try {
        aiSynthesis = await geminiProvider.synthesizeExecutive(synthesisData);
        aiProvider = "gemini";
      } catch (err) {
        console.warn("Gemini synthesis failed:", err);
      }
    }

    return sendSuccess({
      insights: deterministicInsights,
      synthesis: aiSynthesis,
      provider: aiProvider,
      metrics: {
        totalPipeline,
        wonValue,
        winRate,
        activeDeals: activeOpps.length,
        totalLeads: leads.length,
        hotLeads,
        conversionRate,
        overdueTasks,
        staleLeads,
      },
    });
  } catch (error: any) {
    console.error("GET /api/ai/insights error:", error);
    return sendUnhandledError();
  }
}
