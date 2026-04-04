import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  action: string;
}

interface ChatResponse {
  message: string;
  suggestions?: Suggestion[];
}

interface CRMContext {
  topOpportunities: { title: string; value: number; stage: string; probability: number; daysInStage: number }[];
  pipelineTotal: number;
  activeDealsCount: number;
  overdueTasksCount: number;
  staleLeadsCount: number;
  recentActivitiesCount: number;
  todayMeetingsCount: number;
  atRiskDealsCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

async function loadCRMContext(organizationId: string, userId: string): Promise<CRMContext> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    topOpps,
    overdueTasks,
    staleLeads,
    recentActivities,
    todayMeetings,
  ] = await Promise.all([
    // Top opportunities by value (active only)
    prisma.opportunity.findMany({
      where: {
        organizationId,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      orderBy: { value: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        value: true,
        stage: true,
        probability: true,
        updatedAt: true,
      },
    }),

    // Overdue tasks
    prisma.task.count({
      where: {
        organizationId,
        status: { not: "COMPLETED" },
        dueDate: { lt: now },
      },
    }),

    // Stale leads (no activity in 30 days)
    prisma.lead.findMany({
      where: {
        organizationId,
        status: { notIn: ["CONVERTED", "UNQUALIFIED"] },
        updatedAt: { lt: thirtyDaysAgo },
      },
      select: { id: true, name: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),

    // Recent activities (last 7 days)
    prisma.activity.count({
      where: {
        organizationId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),

    // Today's meetings
    prisma.meeting.count({
      where: {
        organizationId,
        startTime: { gte: todayStart, lt: todayEnd },
      },
    }),
  ]);

  const pipelineTotal = topOpps.reduce((sum, o) => sum + (o.value || 0), 0);
  const atRiskDeals = topOpps.filter((o) => (o.probability || 0) < 40);

  const enrichedOpps = topOpps.slice(0, 5).map((o) => ({
    title: o.title,
    value: o.value || 0,
    stage: o.stage,
    probability: o.probability || 0,
    daysInStage: Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return {
    topOpportunities: enrichedOpps,
    pipelineTotal,
    activeDealsCount: topOpps.length,
    overdueTasksCount: overdueTasks,
    staleLeadsCount: staleLeads.length,
    recentActivitiesCount: recentActivities,
    todayMeetingsCount: todayMeetings,
    atRiskDealsCount: atRiskDeals.length,
  };
}

function buildSystemPrompt(ctx: CRMContext): string {
  const topDeals = ctx.topOpportunities
    .map(
      (o) =>
        `- ${o.title}: ${formatCurrency(o.value)} (${o.stage}, ${o.probability}% probability, ${o.daysInStage} days in stage)`
    )
    .join("\n");

  return `You are Aexion AI, a consultative CRM assistant for a commercial real estate investment firm. You help users make decisions about their CRM data.

CURRENT CRM SNAPSHOT:
- Pipeline total: ${formatCurrency(ctx.pipelineTotal)} across ${ctx.activeDealsCount} active deals
- At-risk deals (probability < 40%): ${ctx.atRiskDealsCount}
- Overdue tasks: ${ctx.overdueTasksCount}
- Stale leads (no activity in 30+ days): ${ctx.staleLeadsCount}
- Activities this week: ${ctx.recentActivitiesCount}
- Meetings today: ${ctx.todayMeetingsCount}

TOP DEALS BY VALUE:
${topDeals || "No active deals found."}

BEHAVIOR RULES:
1. Be consultative and proactive. Always end with a question or actionable suggestion.
2. Use specific numbers from the CRM data above — never make up data.
3. Keep responses concise (2-4 sentences max).
4. When discussing deals, reference them by name and value.
5. Prioritize actionable insights over generic advice.
6. If you don't have enough data to answer, say so honestly and suggest what the user could do.
7. Format currency values cleanly (e.g., $18.5M, $250K).
8. If the user asks about something outside CRM scope, politely redirect to CRM topics you can help with.`;
}

function generateRuleBasedResponse(message: string, ctx: CRMContext): ChatResponse {
  const lower = message.toLowerCase();

  // ── Help / Capabilities ──────────────────────────────────────────────
  if (lower.includes("help") || lower.includes("what can you do") || lower.includes("capabilities")) {
    return {
      message:
        "I can help you with several things:\n\n" +
        "- **Pipeline analysis** — deal health, at-risk opportunities, forecasts\n" +
        "- **Lead management** — stale leads, follow-up priorities, conversion insights\n" +
        "- **Task prioritization** — overdue items, daily action plans\n" +
        "- **Revenue forecasting** — pipeline projections and deal probability analysis\n" +
        "- **Daily overview** — quick snapshot of what needs your attention\n\n" +
        "What would you like to start with?",
      suggestions: [
        { label: "Pipeline overview", action: "Give me a pipeline overview" },
        { label: "My daily overview", action: "What should I focus on today?" },
        { label: "Stale leads", action: "Show me stale leads" },
      ],
    };
  }

  // ── Leads ────────────────────────────────────────────────────────────
  if (lower.includes("lead") || lower.includes("leads") || lower.includes("stale")) {
    if (ctx.staleLeadsCount === 0) {
      return {
        message:
          "Great news — you have no stale leads right now. All your leads have been touched in the last 30 days. " +
          "Want me to look at your pipeline health instead?",
        suggestions: [
          { label: "Pipeline health", action: "How is my pipeline doing?" },
          { label: "Today's tasks", action: "What tasks are due today?" },
        ],
      };
    }

    return {
      message:
        `You have ${ctx.staleLeadsCount} stale lead${ctx.staleLeadsCount === 1 ? "" : "s"} — ` +
        `these haven't been touched in over 30 days and are at risk of going cold. ` +
        `I'd recommend prioritizing outreach on these before they become unrecoverable. ` +
        `Want me to help you plan a re-engagement strategy?`,
      suggestions: [
        { label: "View stale leads", action: "Show me details on the stale leads" },
        { label: "Re-engage plan", action: "Help me create a lead re-engagement plan" },
        { label: "Pipeline check", action: "How about my pipeline?" },
      ],
    };
  }

  // ── Deals / Pipeline / Opportunities ─────────────────────────────────
  if (
    lower.includes("deal") ||
    lower.includes("opportunity") ||
    lower.includes("pipeline") ||
    lower.includes("opportunities")
  ) {
    const topDeal = ctx.topOpportunities[0];
    const atRiskNote =
      ctx.atRiskDealsCount > 0
        ? ` ${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount === 1 ? " has" : "s have"} probability below 40% — these need attention.`
        : " All deals have healthy probability scores.";

    let msg =
      `Your pipeline is at ${formatCurrency(ctx.pipelineTotal)} with ${ctx.activeDealsCount} active deal${ctx.activeDealsCount === 1 ? "" : "s"}.` +
      atRiskNote;

    if (topDeal) {
      msg +=
        ` Your largest deal is ${topDeal.title} at ${formatCurrency(topDeal.value)} ` +
        `(${topDeal.stage}, ${topDeal.probability}% probability, ${topDeal.daysInStage} days in current stage).`;

      if (topDeal.daysInStage > 14) {
        msg += ` This one has been in ${topDeal.stage} for a while — should I flag it for review?`;
      } else {
        msg += " Want me to analyze the at-risk deals in more detail?";
      }
    }

    const suggestions: Suggestion[] = [
      { label: "Open pipeline", action: "Show me pipeline details" },
    ];
    if (ctx.atRiskDealsCount > 0) {
      suggestions.push({ label: "At-risk deals", action: "Analyze my at-risk deals" });
    }
    suggestions.push({ label: "Forecast", action: "Give me a revenue forecast" });

    return { message: msg, suggestions };
  }

  // ── Tasks / Overdue ──────────────────────────────────────────────────
  if (lower.includes("task") || lower.includes("overdue") || lower.includes("to-do") || lower.includes("todo")) {
    if (ctx.overdueTasksCount === 0) {
      return {
        message:
          "You're all caught up — no overdue tasks right now. " +
          `You have ${ctx.todayMeetingsCount} meeting${ctx.todayMeetingsCount === 1 ? "" : "s"} scheduled for today. ` +
          "Anything else you'd like to check on?",
        suggestions: [
          { label: "Pipeline check", action: "How is my pipeline?" },
          { label: "Lead status", action: "Any stale leads?" },
        ],
      };
    }

    return {
      message:
        `You have ${ctx.overdueTasksCount} overdue task${ctx.overdueTasksCount === 1 ? "" : "s"} that need attention. ` +
        `Letting these slip can impact deal momentum and client relationships. ` +
        `I'd suggest tackling the highest-priority ones first. Want me to help you prioritize?`,
      suggestions: [
        { label: "Check overdue tasks", action: "List my overdue tasks with priorities" },
        { label: "Today's focus", action: "What should I focus on today?" },
        { label: "Pipeline impact", action: "Are any deals impacted by overdue tasks?" },
      ],
    };
  }

  // ── Forecast / Revenue ───────────────────────────────────────────────
  if (lower.includes("forecast") || lower.includes("revenue") || lower.includes("projection")) {
    const weightedPipeline = ctx.topOpportunities.reduce(
      (sum, o) => sum + o.value * (o.probability / 100),
      0
    );

    return {
      message:
        `Based on current probabilities, your weighted pipeline forecast is ${formatCurrency(weightedPipeline)} ` +
        `from ${ctx.activeDealsCount} active deals (total pipeline: ${formatCurrency(ctx.pipelineTotal)}). ` +
        (ctx.atRiskDealsCount > 0
          ? `${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount === 1 ? "" : "s"} with < 40% probability ` +
            `are dragging the forecast down. Improving those could significantly boost your numbers. `
          : "Your deal probabilities look healthy across the board. ") +
        "Would you like a breakdown by stage?",
      suggestions: [
        { label: "Stage breakdown", action: "Break down pipeline by stage" },
        { label: "At-risk analysis", action: "Which deals are dragging down my forecast?" },
        { label: "Top deals", action: "Tell me about my top deals" },
      ],
    };
  }

  // ── Default: Daily Overview ──────────────────────────────────────────
  const parts: string[] = [];

  if (ctx.overdueTasksCount > 0) {
    parts.push(`${ctx.overdueTasksCount} overdue task${ctx.overdueTasksCount === 1 ? "" : "s"}`);
  }
  if (ctx.staleLeadsCount > 0) {
    parts.push(`${ctx.staleLeadsCount} stale lead${ctx.staleLeadsCount === 1 ? "" : "s"}`);
  }
  if (ctx.todayMeetingsCount > 0) {
    parts.push(`${ctx.todayMeetingsCount} meeting${ctx.todayMeetingsCount === 1 ? "" : "s"} today`);
  }

  let overview: string;
  if (parts.length === 0) {
    overview =
      `Your day looks clear! Pipeline is at ${formatCurrency(ctx.pipelineTotal)} ` +
      `with ${ctx.activeDealsCount} active deals and ${ctx.recentActivitiesCount} activities this week. ` +
      "This might be a good time to prospect or review your deal strategy. What would you like to explore?";
  } else {
    overview =
      `Here's your snapshot: you have ${parts.join(", ")}. ` +
      `Your pipeline sits at ${formatCurrency(ctx.pipelineTotal)} across ${ctx.activeDealsCount} active deals. `;

    if (ctx.overdueTasksCount > 0 && ctx.staleLeadsCount > 0) {
      overview += "I'd prioritize the overdue tasks first, then work on re-engaging those stale leads. What should we tackle?";
    } else if (ctx.overdueTasksCount > 0) {
      overview += "Want me to help you prioritize those overdue tasks?";
    } else if (ctx.staleLeadsCount > 0) {
      overview += "Those stale leads should be re-engaged soon. Want me to help plan outreach?";
    } else {
      overview += "Anything specific you'd like to dive into?";
    }
  }

  const defaultSuggestions: Suggestion[] = [];
  if (ctx.overdueTasksCount > 0) {
    defaultSuggestions.push({ label: "Check overdue tasks", action: "Show my overdue tasks" });
  }
  if (ctx.staleLeadsCount > 0) {
    defaultSuggestions.push({ label: "View stale leads", action: "Show stale leads" });
  }
  defaultSuggestions.push({ label: "Open pipeline", action: "Give me a pipeline overview" });

  return { message: overview, suggestions: defaultSuggestions };
}

// ─── POST /api/ai/chat ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai-chat:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    // Parse body
    let body: { message?: string };
    try {
      body = await request.json();
    } catch {
      return sendError(badRequest("Invalid JSON body"));
    }

    const message = body.message?.trim();
    if (!message) return sendError(badRequest("message is required"));
    if (message.length > 2000) return sendError(badRequest("Message too long (max 2000 characters)"));

    const userId = (session.user as any).id;
    const organizationId = (session.user as any).organizationId;

    if (!organizationId) {
      return sendSuccess<ChatResponse>({
        message:
          "It looks like your account isn't linked to an organization yet. " +
          "Please complete onboarding first so I can access your CRM data. " +
          "Need help with anything else?",
      });
    }

    // Load CRM context
    const ctx = await loadCRMContext(organizationId, userId);

    // ── Try AI provider first ─────────────────────────────────────────
    if (openaiTaskProvider.isConfigured()) {
      try {
        const systemPrompt = buildSystemPrompt(ctx);

        const result = await openaiTaskProvider.generateText(
          message,
          {
            maxTokens: 400,
            temperature: 0.7,
            systemInstruction: systemPrompt,
          }
        );

        // Generate contextual suggestions based on the message
        const suggestions = generateSuggestionsForMessage(message, ctx);

        return sendSuccess<ChatResponse>({
          message: result.text,
          suggestions,
        });
      } catch (err) {
        console.warn("[ai-chat] OpenAI call failed, falling back to rule-based:", err);
      }
    }

    // ── Rule-based fallback ───────────────────────────────────────────
    const response = generateRuleBasedResponse(message, ctx);

    return sendSuccess<ChatResponse>(response);
  } catch (error: any) {
    console.error("POST /api/ai/chat error:", error);
    return sendUnhandledError();
  }
}

// ─── Suggestion Generator (used when AI provider responds) ──────────────────

function generateSuggestionsForMessage(message: string, ctx: CRMContext): Suggestion[] {
  const lower = message.toLowerCase();
  const suggestions: Suggestion[] = [];

  if (lower.includes("lead") || lower.includes("stale")) {
    suggestions.push({ label: "View stale leads", action: "Show me stale lead details" });
  }
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity")) {
    suggestions.push({ label: "Open pipeline", action: "Break down my pipeline" });
  }
  if (lower.includes("task") || lower.includes("overdue")) {
    suggestions.push({ label: "Check overdue tasks", action: "List my overdue tasks" });
  }
  if (lower.includes("forecast") || lower.includes("revenue")) {
    suggestions.push({ label: "Revenue forecast", action: "Give me a detailed forecast" });
  }

  // Always offer at least one follow-up
  if (suggestions.length === 0) {
    if (ctx.overdueTasksCount > 0) {
      suggestions.push({ label: "Check overdue tasks", action: "Show my overdue tasks" });
    }
    if (ctx.atRiskDealsCount > 0) {
      suggestions.push({ label: "At-risk deals", action: "Which deals are at risk?" });
    }
    suggestions.push({ label: "Daily overview", action: "Give me my daily overview" });
  }

  return suggestions.slice(0, 3);
}
