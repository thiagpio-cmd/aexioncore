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

interface DealInfo { title: string; value: number; stage: string; probability: number; daysInStage: number }
interface LeadInfo { name: string; email: string; status: string; temperature: string; fitScore: number; daysSinceUpdate: number; company: string }
interface TaskInfo { title: string; priority: string; status: string; dueDate: string | null; relatedTo: string | null; daysOverdue: number }
interface MeetingInfo { title: string; startTime: string; attendees: string; relatedTo: string | null }
interface AccountInfo { name: string; status: string; isCustomer: boolean; onboardingStatus: string; company: string }
interface ContactInfo { name: string; email: string; title: string | null; company: string; isChampion: boolean; isDecisionMaker: boolean }
interface ActivityInfo { type: string; subject: string | null; channel: string | null; relatedTo: string | null; createdAt: string }
interface CompanyInfo { name: string; industry: string | null; contactsCount: number; leadsCount: number; accountsCount: number }

interface CRMContext {
  // Deals & pipeline
  topOpportunities: DealInfo[];
  atRiskDeals: DealInfo[];
  pipelineTotal: number;
  activeDealsCount: number;
  atRiskDealsCount: number;
  // Leads
  allLeads: LeadInfo[];
  staleLeads: LeadInfo[];
  staleLeadsCount: number;
  totalLeadsCount: number;
  leadsByStatus: Record<string, number>;
  // Tasks
  overdueTasks: TaskInfo[];
  upcomingTasks: TaskInfo[];
  overdueTasksCount: number;
  totalTasksCount: number;
  // Meetings
  todayMeetings: MeetingInfo[];
  upcomingMeetings: MeetingInfo[];
  todayMeetingsCount: number;
  // Activities
  recentActivities: ActivityInfo[];
  recentActivitiesCount: number;
  // Accounts & contacts
  accounts: AccountInfo[];
  totalAccountsCount: number;
  contacts: ContactInfo[];
  totalContactsCount: number;
  // Companies
  companies: CompanyInfo[];
  totalCompaniesCount: number;
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
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dayMs = 1000 * 60 * 60 * 24;

  const [
    topOpps,
    allLeadsRaw,
    leadsByStatusRaw,
    totalLeads,
    overdueTasksRaw,
    upcomingTasksRaw,
    totalTasks,
    todayMeetingsRaw,
    upcomingMeetingsRaw,
    recentActivitiesRaw,
    recentActivitiesCount,
    accountsRaw,
    totalAccounts,
    contactsRaw,
    totalContacts,
    companiesRaw,
    totalCompanies,
  ] = await Promise.all([
    // ── Opportunities ──
    prisma.opportunity.findMany({
      where: { organizationId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      orderBy: { value: "desc" },
      take: 10,
      select: { title: true, value: true, stage: true, probability: true, updatedAt: true },
    }),

    // ── Leads (all active, top 15) ──
    prisma.lead.findMany({
      where: { organizationId, status: { notIn: ["CONVERTED", "UNQUALIFIED"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, email: true, status: true, temperature: true, fitScore: true, updatedAt: true, company: { select: { name: true } } },
    }),
    // Leads grouped by status
    prisma.lead.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }),
    prisma.lead.count({ where: { organizationId } }),

    // ── Tasks (overdue) ──
    prisma.task.findMany({
      where: { organizationId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { title: true, priority: true, status: true, dueDate: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }),
    // Upcoming tasks (next 7 days)
    prisma.task.findMany({
      where: { organizationId, status: { not: "COMPLETED" }, dueDate: { gte: now, lt: nextWeek } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { title: true, priority: true, status: true, dueDate: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }),
    prisma.task.count({ where: { organizationId, status: { not: "COMPLETED" } } }),

    // ── Meetings (today) ──
    prisma.meeting.findMany({
      where: { organizationId, startTime: { gte: todayStart, lt: todayEnd } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, attendees: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }),
    // Upcoming meetings (next 7 days)
    prisma.meeting.findMany({
      where: { organizationId, startTime: { gte: todayEnd, lt: nextWeek } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, attendees: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }),

    // ── Activities (recent) ──
    prisma.activity.findMany({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { type: true, subject: true, channel: true, createdAt: true, leadId: true, opportunityId: true },
    }),
    prisma.activity.count({ where: { organizationId, createdAt: { gte: sevenDaysAgo } } }),

    // ── Accounts ──
    prisma.account.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, status: true, isCustomer: true, onboardingStatus: true, company: { select: { name: true } } },
    }),
    prisma.account.count({ where: { organizationId } }),

    // ── Contacts ──
    prisma.contact.findMany({
      where: { company: { organizationId } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, email: true, title: true, isChampion: true, isDecisionMaker: true, company: { select: { name: true } } },
    }),
    prisma.contact.count({ where: { company: { organizationId } } }),

    // ── Companies ──
    prisma.company.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, industry: true, _count: { select: { contacts: true, leads: true, accounts: true } } },
    }),
    prisma.company.count({ where: { organizationId } }),
  ]);

  // ── Enrich data ──
  const enrichOpp = (o: typeof topOpps[0]): DealInfo => ({
    title: o.title,
    value: o.value || 0,
    stage: o.stage,
    probability: o.probability || 0,
    daysInStage: Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / dayMs),
  });

  const enrichedOpps = topOpps.slice(0, 5).map(enrichOpp);
  const atRiskDeals = topOpps.filter((o) => (o.probability || 0) < 40).map(enrichOpp);
  const pipelineTotal = topOpps.reduce((sum, o) => sum + (o.value || 0), 0);

  const enrichedLeads: LeadInfo[] = allLeadsRaw.map((l) => ({
    name: l.name,
    email: l.email,
    status: l.status,
    temperature: l.temperature,
    fitScore: l.fitScore,
    daysSinceUpdate: Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / dayMs),
    company: l.company?.name || "—",
  }));
  const staleLeads = enrichedLeads.filter((l) => l.daysSinceUpdate >= 30);

  const enrichTask = (t: typeof overdueTasksRaw[0]): TaskInfo => ({
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
    relatedTo: t.opportunity?.title || t.lead?.name || null,
    daysOverdue: t.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / dayMs)) : 0,
  });

  const enrichMeeting = (m: typeof todayMeetingsRaw[0]): MeetingInfo => {
    let attendeeStr = "—";
    try {
      const parsed = JSON.parse(m.attendees || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        attendeeStr = parsed.slice(0, 3).join(", ") + (parsed.length > 3 ? ` +${parsed.length - 3}` : "");
      }
    } catch { /* ignore */ }
    return {
      title: m.title,
      startTime: new Date(m.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      attendees: attendeeStr,
      relatedTo: m.opportunity?.title || m.lead?.name || null,
    };
  };

  const leadStatusMap: Record<string, number> = {};
  for (const g of leadsByStatusRaw) {
    leadStatusMap[g.status] = g._count;
  }

  return {
    topOpportunities: enrichedOpps,
    atRiskDeals,
    pipelineTotal,
    activeDealsCount: topOpps.length,
    atRiskDealsCount: atRiskDeals.length,

    allLeads: enrichedLeads,
    staleLeads,
    staleLeadsCount: staleLeads.length,
    totalLeadsCount: totalLeads,
    leadsByStatus: leadStatusMap,

    overdueTasks: overdueTasksRaw.map(enrichTask),
    upcomingTasks: upcomingTasksRaw.map(enrichTask),
    overdueTasksCount: overdueTasksRaw.length,
    totalTasksCount: totalTasks,

    todayMeetings: todayMeetingsRaw.map(enrichMeeting),
    upcomingMeetings: upcomingMeetingsRaw.map(enrichMeeting),
    todayMeetingsCount: todayMeetingsRaw.length,

    recentActivities: recentActivitiesRaw.map((a) => ({
      type: a.type,
      subject: a.subject,
      channel: a.channel,
      relatedTo: null,
      createdAt: new Date(a.createdAt).toISOString().split("T")[0],
    })),
    recentActivitiesCount: recentActivitiesCount,

    accounts: accountsRaw.map((a) => ({
      name: a.name,
      status: a.status,
      isCustomer: a.isCustomer,
      onboardingStatus: a.onboardingStatus,
      company: a.company?.name || "—",
    })),
    totalAccountsCount: totalAccounts,

    contacts: contactsRaw.map((c) => ({
      name: c.name,
      email: c.email,
      title: c.title,
      company: c.company?.name || "—",
      isChampion: c.isChampion,
      isDecisionMaker: c.isDecisionMaker,
    })),
    totalContactsCount: totalContacts,

    companies: companiesRaw.map((c) => ({
      name: c.name,
      industry: c.industry,
      contactsCount: c._count.contacts,
      leadsCount: c._count.leads,
      accountsCount: c._count.accounts,
    })),
    totalCompaniesCount: totalCompanies,
  };
}

function buildSystemPrompt(ctx: CRMContext): string {
  const fmtStage = (s: string) => s.replace(/_/g, " ").toLowerCase();

  const topDeals = ctx.topOpportunities
    .map((o) => `- ${o.title}: ${formatCurrency(o.value)} (${fmtStage(o.stage)}, ${o.probability}% prob, ${o.daysInStage}d in stage)`)
    .join("\n");

  const atRiskDeals = ctx.atRiskDeals
    .map((d) => `- ${d.title}: ${formatCurrency(d.value)} at ${d.probability}% (${fmtStage(d.stage)}, ${d.daysInStage}d)`)
    .join("\n");

  const leadStatusLine = Object.entries(ctx.leadsByStatus).map(([s, c]) => `${fmtStage(s)}: ${c}`).join(", ");

  const leadsList = ctx.allLeads.slice(0, 10)
    .map((l) => `- ${l.name} (${l.company}) — ${fmtStage(l.status)}, ${l.temperature.toLowerCase()}, fit: ${l.fitScore}/100, ${l.daysSinceUpdate}d since update`)
    .join("\n");

  const overdueTasksList = ctx.overdueTasks.slice(0, 5)
    .map((t) => `- ${t.title} [${t.priority}] — ${t.daysOverdue}d overdue${t.relatedTo ? ` (re: ${t.relatedTo})` : ""}`)
    .join("\n");

  const upcomingTasksList = ctx.upcomingTasks.slice(0, 5)
    .map((t) => `- ${t.title} [${t.priority}] — due ${t.dueDate}${t.relatedTo ? ` (re: ${t.relatedTo})` : ""}`)
    .join("\n");

  const todayMeetingsList = ctx.todayMeetings
    .map((m) => `- ${m.startTime}: ${m.title}${m.relatedTo ? ` (re: ${m.relatedTo})` : ""} — ${m.attendees}`)
    .join("\n");

  const upcomingMeetingsList = ctx.upcomingMeetings.slice(0, 5)
    .map((m) => `- ${m.startTime}: ${m.title}${m.relatedTo ? ` (re: ${m.relatedTo})` : ""}`)
    .join("\n");

  const accountsList = ctx.accounts.slice(0, 10)
    .map((a) => `- ${a.name} (${a.company}) — ${a.status}${a.isCustomer ? ", customer" : ""}${a.onboardingStatus !== "PENDING" ? `, onboarding: ${fmtStage(a.onboardingStatus)}` : ""}`)
    .join("\n");

  const contactsList = ctx.contacts.slice(0, 10)
    .map((c) => `- ${c.name} (${c.company})${c.title ? ` — ${c.title}` : ""}${c.isChampion ? " ★champion" : ""}${c.isDecisionMaker ? " ★DM" : ""}`)
    .join("\n");

  const companiesList = ctx.companies.slice(0, 10)
    .map((c) => `- ${c.name}${c.industry ? ` (${c.industry})` : ""} — ${c.contactsCount} contacts, ${c.leadsCount} leads, ${c.accountsCount} accounts`)
    .join("\n");

  const recentActivityList = ctx.recentActivities.slice(0, 5)
    .map((a) => `- [${a.createdAt}] ${a.type}${a.subject ? `: ${a.subject}` : ""}${a.channel ? ` via ${a.channel}` : ""}`)
    .join("\n");

  return `You are Aexion AI, a consultative CRM assistant for a commercial real estate investment firm. You have FULL access to the user's CRM data and should answer ANY question about it with specific names, numbers, and details.

═══ PIPELINE (${ctx.activeDealsCount} active deals, ${formatCurrency(ctx.pipelineTotal)} total) ═══
${topDeals || "No active deals."}

═══ AT-RISK DEALS (probability < 40%): ${ctx.atRiskDealsCount} ═══
${atRiskDeals || "None — all healthy."}

═══ LEADS (${ctx.totalLeadsCount} total | ${leadStatusLine}) ═══
${leadsList || "No active leads."}
Stale (30+ days no activity): ${ctx.staleLeadsCount}

═══ TASKS (${ctx.totalTasksCount} open) ═══
Overdue (${ctx.overdueTasksCount}):
${overdueTasksList || "None overdue."}
Upcoming this week:
${upcomingTasksList || "None scheduled."}

═══ MEETINGS ═══
Today (${ctx.todayMeetingsCount}):
${todayMeetingsList || "No meetings today."}
Upcoming this week:
${upcomingMeetingsList || "None scheduled."}

═══ ACCOUNTS (${ctx.totalAccountsCount} total) ═══
${accountsList || "No accounts."}

═══ CONTACTS (${ctx.totalContactsCount} total) ═══
${contactsList || "No contacts."}

═══ COMPANIES (${ctx.totalCompaniesCount} total) ═══
${companiesList || "No companies."}

═══ RECENT ACTIVITY (last 7 days: ${ctx.recentActivitiesCount}) ═══
${recentActivityList || "No recent activities."}

BEHAVIOR RULES:
1. Be consultative and proactive. Always end with a question or actionable suggestion.
2. Use SPECIFIC names, numbers, and data from above — NEVER make up data or use placeholders.
3. Keep responses concise (3-5 sentences). Use markdown bold for key names/numbers.
4. When discussing deals, reference them by name and value.
5. Prioritize actionable insights over generic advice.
6. If asked about data not shown above, say what you do see and suggest navigation.
7. Format currency cleanly ($18.5M, $250K).
8. Cross-reference data: if a task relates to a deal, mention the deal context.
9. Be proactive: if you notice issues (stale leads, stuck deals, overdue tasks), mention them.
10. Answer in the SAME LANGUAGE the user writes in (Portuguese → Portuguese, English → English).`;
}

function generateRuleBasedResponse(message: string, ctx: CRMContext): ChatResponse {
  const lower = message.toLowerCase();

  // ── Help / Capabilities ──────────────────────────────────────────────
  if (lower.includes("help") || lower.includes("what can you do") || lower.includes("capabilit") || lower.includes("ajuda") || lower.includes("o que você")) {
    return {
      message:
        "I have access to **all your CRM data** and can help with:\n\n" +
        "- **Pipeline & Deals** — overview, at-risk deals, stage breakdown, forecasts\n" +
        "- **Leads** — stale leads, status breakdown, follow-up priorities\n" +
        "- **Tasks** — overdue items, upcoming tasks, daily action plans\n" +
        "- **Meetings** — today's schedule, upcoming calendar, prep support\n" +
        "- **Accounts** — customer list, onboarding status, account health\n" +
        "- **Contacts** — champions, decision makers, key people\n" +
        "- **Companies** — portfolio overview, industry breakdown\n" +
        "- **Activities** — recent activity log, engagement trends\n" +
        "- **Revenue forecast** — weighted projections, stage breakdown\n\n" +
        "Just ask me anything about your data! What would you like to explore?",
      suggestions: [
        { label: "Daily overview", action: "What should I focus on today?" },
        { label: "Pipeline", action: "Give me a pipeline overview" },
        { label: "My leads", action: "Show me my leads" },
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

    const leadList = ctx.staleLeads
      .slice(0, 5)
      .map((l) => `  • **${l.name}** — ${l.daysSinceUpdate} days without activity (${l.status.replace(/_/g, " ").toLowerCase()})`)
      .join("\n");

    return {
      message:
        `You have **${ctx.staleLeadsCount} stale lead${ctx.staleLeadsCount === 1 ? "" : "s"}** going cold:\n\n` +
        leadList +
        (ctx.staleLeadsCount > 5 ? `\n  ...and ${ctx.staleLeadsCount - 5} more.\n\n` : "\n\n") +
        `These haven't been touched in over 30 days. I'd recommend re-engaging the oldest ones first — ` +
        `**${ctx.staleLeads[0]?.name}** is the most urgent at ${ctx.staleLeads[0]?.daysSinceUpdate} days. ` +
        `Want me to help you draft a re-engagement plan?`,
      suggestions: [
        { label: "Re-engage plan", action: "Help me create a re-engagement plan for stale leads" },
        { label: "Pipeline check", action: "How is my pipeline?" },
        { label: "Focus priorities", action: "What should I focus on today?" },
      ],
    };
  }

  // ── At-Risk Deals (specific handler) ──────────────────────────────
  if (lower.includes("risk") || lower.includes("at-risk") || lower.includes("at risk") || lower.includes("danger")) {
    if (ctx.atRiskDealsCount === 0) {
      return {
        message:
          `No at-risk deals right now — all ${ctx.activeDealsCount} active deals have probability ≥ 40%. ` +
          `Your pipeline looks healthy at ${formatCurrency(ctx.pipelineTotal)}. Keep the momentum going! ` +
          `Want me to look at something else?`,
        suggestions: [
          { label: "Pipeline breakdown", action: "Break down my pipeline by stage" },
          { label: "Stale leads", action: "Do I have any stale leads?" },
          { label: "Revenue forecast", action: "Give me a forecast" },
        ],
      };
    }

    const dealList = ctx.atRiskDeals
      .map((d) =>
        `  • **${d.title}** — ${formatCurrency(d.value)} at ${d.probability}% probability (${d.stage.replace(/_/g, " ")}, ${d.daysInStage} days in stage)`
      )
      .join("\n");

    const totalAtRiskValue = ctx.atRiskDeals.reduce((s, d) => s + d.value, 0);

    return {
      message:
        `You have **${ctx.atRiskDealsCount} at-risk deal${ctx.atRiskDealsCount === 1 ? "" : "s"}** ` +
        `worth ${formatCurrency(totalAtRiskValue)} total:\n\n` +
        dealList + "\n\n" +
        `These are dragging your weighted forecast down. ` +
        (ctx.atRiskDeals.some((d) => d.daysInStage > 14)
          ? `Some have been stuck in the same stage for over 2 weeks — those are the most urgent. `
          : "") +
        `I'd recommend scheduling follow-ups on these this week. Want me to help prioritize?`,
      suggestions: [
        { label: "Prioritize deals", action: "Help me prioritize my at-risk deals" },
        { label: "Full pipeline", action: "Show my full pipeline overview" },
        { label: "Revenue impact", action: "How much revenue am I losing from at-risk deals?" },
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
    const dealBreakdown = ctx.topOpportunities
      .slice(0, 5)
      .map((d) =>
        `  • **${d.title}** — ${formatCurrency(d.value)} (${d.stage.replace(/_/g, " ")}, ${d.probability}% prob, ${d.daysInStage}d in stage)`
      )
      .join("\n");

    let msg =
      `Your pipeline is at **${formatCurrency(ctx.pipelineTotal)}** with ${ctx.activeDealsCount} active deal${ctx.activeDealsCount === 1 ? "" : "s"}.\n\n` +
      `**Top deals:**\n${dealBreakdown || "No active deals."}\n\n`;

    if (ctx.atRiskDealsCount > 0) {
      const atRiskNames = ctx.atRiskDeals.slice(0, 3).map((d) => d.title).join(", ");
      msg += `⚠ ${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount === 1 ? "" : "s"} at risk (< 40% probability): ${atRiskNames}. Want me to dig into those?`;
    } else {
      msg += "All deals have healthy probability scores. Want a revenue forecast?";
    }

    const suggestions: Suggestion[] = [];
    if (ctx.atRiskDealsCount > 0) {
      suggestions.push({ label: "At-risk deals", action: "Analyze my at-risk deals" });
    }
    suggestions.push({ label: "Forecast", action: "Give me a revenue forecast" });
    suggestions.push({ label: "Stale leads", action: "Any stale leads?" });

    return { message: msg, suggestions };
  }

  // ── Tasks / Overdue ──────────────────────────────────────────────────
  if (lower.includes("task") || lower.includes("overdue") || lower.includes("to-do") || lower.includes("todo")) {
    if (ctx.overdueTasksCount === 0 && ctx.upcomingTasks.length === 0) {
      return {
        message:
          `You're all caught up — no overdue or upcoming tasks. ` +
          `${ctx.totalTasksCount > 0 ? `You have ${ctx.totalTasksCount} total open tasks. ` : ""}` +
          `Anything else you'd like to check?`,
        suggestions: [
          { label: "Pipeline check", action: "How is my pipeline?" },
          { label: "Lead status", action: "Any stale leads?" },
        ],
      };
    }

    let msg = "";
    if (ctx.overdueTasksCount > 0) {
      const taskList = ctx.overdueTasks.slice(0, 5)
        .map((t) => `  • **${t.title}** [${t.priority}] — ${t.daysOverdue}d overdue${t.relatedTo ? ` (${t.relatedTo})` : ""}`)
        .join("\n");
      msg += `**${ctx.overdueTasksCount} overdue task${ctx.overdueTasksCount === 1 ? "" : "s"}:**\n${taskList}\n\n`;
    }
    if (ctx.upcomingTasks.length > 0) {
      const upcoming = ctx.upcomingTasks.slice(0, 3)
        .map((t) => `  • **${t.title}** [${t.priority}] — due ${t.dueDate}${t.relatedTo ? ` (${t.relatedTo})` : ""}`)
        .join("\n");
      msg += `**Upcoming this week:**\n${upcoming}\n\n`;
    }
    msg += ctx.overdueTasksCount > 0
      ? `I'd prioritize the HIGH priority overdue items first. Want me to help you plan your task attack order?`
      : `Looking good — just stay on top of the upcoming ones. Need help with anything else?`;

    return {
      message: msg,
      suggestions: [
        { label: "Daily focus", action: "What should I focus on today?" },
        { label: "Pipeline check", action: "How is my pipeline?" },
        ...(ctx.staleLeadsCount > 0 ? [{ label: "Stale leads", action: "Show stale leads" }] : []),
      ],
    };
  }

  // ── Meetings / Calendar ─────────────────────────────────────────────
  if (lower.includes("meeting") || lower.includes("reunião") || lower.includes("reuniao") || lower.includes("calendar") || lower.includes("agenda") || lower.includes("schedule")) {
    let msg = "";
    if (ctx.todayMeetings.length > 0) {
      const todayList = ctx.todayMeetings
        .map((m) => `  • **${m.startTime}** — ${m.title}${m.relatedTo ? ` (${m.relatedTo})` : ""} | ${m.attendees}`)
        .join("\n");
      msg += `**Today's meetings (${ctx.todayMeetingsCount}):**\n${todayList}\n\n`;
    } else {
      msg += "No meetings scheduled for today.\n\n";
    }
    if (ctx.upcomingMeetings.length > 0) {
      const upList = ctx.upcomingMeetings.slice(0, 5)
        .map((m) => `  • ${m.title}${m.relatedTo ? ` (${m.relatedTo})` : ""}`)
        .join("\n");
      msg += `**Upcoming this week:**\n${upList}\n\n`;
    }
    msg += ctx.todayMeetings.length > 0
      ? `Your first meeting is at ${ctx.todayMeetings[0].startTime}. Make sure you're prepared! Need a pipeline review before your calls?`
      : "Your calendar is clear — great time to focus on prospecting or deal follow-ups. What would you like to work on?";

    return {
      message: msg,
      suggestions: [
        { label: "Pipeline review", action: "Give me a pipeline overview" },
        { label: "Tasks due", action: "What tasks are due?" },
        { label: "Lead follow-ups", action: "Which leads need follow-up?" },
      ],
    };
  }

  // ── Accounts ────────────────────────────────────────────────────────
  if (lower.includes("account") || lower.includes("conta") || lower.includes("customer") || lower.includes("cliente") || lower.includes("onboarding")) {
    const accountList = ctx.accounts.slice(0, 8)
      .map((a) => `  • **${a.name}** (${a.company}) — ${a.status}${a.isCustomer ? " ✓ customer" : ""}${a.onboardingStatus !== "PENDING" ? `, onboarding: ${a.onboardingStatus.toLowerCase()}` : ""}`)
      .join("\n");

    const customers = ctx.accounts.filter((a) => a.isCustomer);

    return {
      message:
        `You have **${ctx.totalAccountsCount} account${ctx.totalAccountsCount === 1 ? "" : "s"}** ` +
        `(${customers.length} active customer${customers.length === 1 ? "" : "s"}):\n\n` +
        (accountList || "No accounts found.") +
        (ctx.totalAccountsCount > 8 ? `\n  ...and ${ctx.totalAccountsCount - 8} more.\n\n` : "\n\n") +
        `Want me to analyze account health or look at specific accounts?`,
      suggestions: [
        { label: "Pipeline", action: "Show my pipeline" },
        { label: "Contacts", action: "Who are my key contacts?" },
        { label: "Companies", action: "List my companies" },
      ],
    };
  }

  // ── Contacts ────────────────────────────────────────────────────────
  if (lower.includes("contact") || lower.includes("contato") || lower.includes("champion") || lower.includes("decision maker")) {
    const champions = ctx.contacts.filter((c) => c.isChampion);
    const decisionMakers = ctx.contacts.filter((c) => c.isDecisionMaker);

    const contactList = ctx.contacts.slice(0, 8)
      .map((c) => `  • **${c.name}** (${c.company})${c.title ? ` — ${c.title}` : ""}${c.isChampion ? " ★champion" : ""}${c.isDecisionMaker ? " ★DM" : ""}`)
      .join("\n");

    return {
      message:
        `You have **${ctx.totalContactsCount} contact${ctx.totalContactsCount === 1 ? "" : "s"}** ` +
        `(${champions.length} champion${champions.length === 1 ? "" : "s"}, ${decisionMakers.length} decision maker${decisionMakers.length === 1 ? "" : "s"}):\n\n` +
        (contactList || "No contacts found.") +
        (ctx.totalContactsCount > 8 ? `\n  ...and ${ctx.totalContactsCount - 8} more.\n\n` : "\n\n") +
        (champions.length > 0
          ? `Your champions are key — make sure you're nurturing **${champions[0].name}**. `
          : "Consider identifying champions in your accounts for stronger deal support. ") +
        "Want to dive deeper into any contact?",
      suggestions: [
        { label: "Accounts", action: "Show my accounts" },
        { label: "Companies", action: "List companies" },
        { label: "Pipeline", action: "Pipeline overview" },
      ],
    };
  }

  // ── Companies ───────────────────────────────────────────────────────
  if (lower.includes("company") || lower.includes("companies") || lower.includes("empresa") || lower.includes("organization")) {
    const companyList = ctx.companies.slice(0, 8)
      .map((c) => `  • **${c.name}**${c.industry ? ` (${c.industry})` : ""} — ${c.contactsCount} contacts, ${c.leadsCount} leads, ${c.accountsCount} accounts`)
      .join("\n");

    return {
      message:
        `You have **${ctx.totalCompaniesCount} compan${ctx.totalCompaniesCount === 1 ? "y" : "ies"}** in your CRM:\n\n` +
        (companyList || "No companies found.") +
        (ctx.totalCompaniesCount > 8 ? `\n  ...and ${ctx.totalCompaniesCount - 8} more.\n\n` : "\n\n") +
        `Want me to analyze any specific company or check for companies without active leads?`,
      suggestions: [
        { label: "Contacts", action: "Show my contacts" },
        { label: "Accounts", action: "List accounts" },
        { label: "Pipeline", action: "Pipeline overview" },
      ],
    };
  }

  // ── Activities ──────────────────────────────────────────────────────
  if (lower.includes("activit") || lower.includes("atividade") || lower.includes("history") || lower.includes("log")) {
    const activityList = ctx.recentActivities.slice(0, 5)
      .map((a) => `  • [${a.createdAt}] **${a.type}**${a.subject ? `: ${a.subject}` : ""}${a.channel ? ` (${a.channel})` : ""}`)
      .join("\n");

    return {
      message:
        `**${ctx.recentActivitiesCount} activities** in the last 7 days:\n\n` +
        (activityList || "No recent activities.") +
        (ctx.recentActivitiesCount > 5 ? `\n  ...and ${ctx.recentActivitiesCount - 5} more.\n\n` : "\n\n") +
        (ctx.recentActivitiesCount < 10
          ? "Activity is low — consider increasing outreach to keep deals moving. "
          : "Good activity level! ") +
        "Want to check which deals or leads need more activity?",
      suggestions: [
        { label: "Stale leads", action: "Show stale leads" },
        { label: "Pipeline", action: "Pipeline overview" },
        { label: "Tasks", action: "What tasks are pending?" },
      ],
    };
  }

  // ── Forecast / Revenue ───────────────────────────────────────────────
  if (lower.includes("forecast") || lower.includes("revenue") || lower.includes("projection") || lower.includes("previsão") || lower.includes("receita")) {
    const weightedPipeline = ctx.topOpportunities.reduce(
      (sum, o) => sum + o.value * (o.probability / 100),
      0
    );

    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = o.stage.replace(/_/g, " ");
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
    }
    const breakdownStr = Object.entries(stageBreakdown)
      .map(([s, d]) => `  • **${s}**: ${d.count} deal${d.count === 1 ? "" : "s"} — ${formatCurrency(d.value)}`)
      .join("\n");

    return {
      message:
        `**Weighted forecast: ${formatCurrency(weightedPipeline)}** ` +
        `(from ${formatCurrency(ctx.pipelineTotal)} total pipeline across ${ctx.activeDealsCount} deals).\n\n` +
        `**By stage:**\n${breakdownStr || "No data."}\n\n` +
        (ctx.atRiskDealsCount > 0
          ? `${ctx.atRiskDealsCount} at-risk deal${ctx.atRiskDealsCount === 1 ? " is" : "s are"} dragging the forecast down. Improving those could add significant value. `
          : "Probabilities look healthy across the board. ") +
        "Want to dig into the at-risk deals?",
      suggestions: [
        { label: "At-risk deals", action: "Show at-risk deals" },
        { label: "Top deals", action: "Tell me about my top deals" },
        { label: "Stale leads", action: "Any stale leads?" },
      ],
    };
  }

  // ── Default: Daily Overview ──────────────────────────────────────────
  let overview = "**Your CRM snapshot:**\n\n";

  // Key metrics
  overview += `📊 **Pipeline:** ${formatCurrency(ctx.pipelineTotal)} across ${ctx.activeDealsCount} deals`;
  if (ctx.atRiskDealsCount > 0) {
    overview += ` (${ctx.atRiskDealsCount} at risk)`;
  }
  overview += "\n";

  if (ctx.overdueTasksCount > 0) {
    const topOverdue = ctx.overdueTasks[0];
    overview += `⚠ **${ctx.overdueTasksCount} overdue task${ctx.overdueTasksCount === 1 ? "" : "s"}**`;
    if (topOverdue) overview += ` — most urgent: ${topOverdue.title} (${topOverdue.daysOverdue}d)`;
    overview += "\n";
  }

  if (ctx.staleLeadsCount > 0) {
    overview += `🔴 **${ctx.staleLeadsCount} stale lead${ctx.staleLeadsCount === 1 ? "" : "s"}** need re-engagement\n`;
  }

  if (ctx.todayMeetingsCount > 0) {
    overview += `📅 **${ctx.todayMeetingsCount} meeting${ctx.todayMeetingsCount === 1 ? "" : "s"} today**`;
    if (ctx.todayMeetings[0]) overview += ` — next: ${ctx.todayMeetings[0].title} at ${ctx.todayMeetings[0].startTime}`;
    overview += "\n";
  }

  overview += `👥 ${ctx.totalContactsCount} contacts · ${ctx.totalAccountsCount} accounts · ${ctx.totalCompaniesCount} companies · ${ctx.totalLeadsCount} leads\n`;
  overview += `📈 ${ctx.recentActivitiesCount} activities this week\n\n`;

  // Recommendation
  if (ctx.overdueTasksCount > 0) {
    overview += "I'd start by tackling the overdue tasks — they can stall your deals. What should we work on first?";
  } else if (ctx.atRiskDealsCount > 0) {
    overview += `Focus on the ${ctx.atRiskDealsCount} at-risk deal${ctx.atRiskDealsCount === 1 ? "" : "s"} — they need follow-ups to improve probability. Want details?`;
  } else if (ctx.staleLeadsCount > 0) {
    overview += "Your pipeline looks healthy! Let's re-engage those stale leads before they go cold. Want a plan?";
  } else {
    overview += "Everything looks solid! Want to explore your pipeline or plan prospecting?";
  }

  const defaultSuggestions: Suggestion[] = [];
  if (ctx.overdueTasksCount > 0) defaultSuggestions.push({ label: "Overdue tasks", action: "Show my overdue tasks" });
  if (ctx.atRiskDealsCount > 0) defaultSuggestions.push({ label: "At-risk deals", action: "Show at-risk deals" });
  if (ctx.staleLeadsCount > 0) defaultSuggestions.push({ label: "Stale leads", action: "Show stale leads" });
  if (defaultSuggestions.length === 0) {
    defaultSuggestions.push({ label: "Pipeline", action: "Pipeline overview" });
    defaultSuggestions.push({ label: "Forecast", action: "Revenue forecast" });
  }
  defaultSuggestions.push({ label: "All data", action: "What data do you have access to?" });

  return { message: overview, suggestions: defaultSuggestions.slice(0, 3) };
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

  // Context-aware follow-ups based on what the user asked about
  if (lower.includes("lead") || lower.includes("stale")) {
    suggestions.push({ label: "Pipeline", action: "How is my pipeline?" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Re-engage plan", action: "Help me re-engage stale leads" });
  }
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity")) {
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "At-risk deals", action: "Show at-risk deals" });
    suggestions.push({ label: "Forecast", action: "Revenue forecast" });
  }
  if (lower.includes("task") || lower.includes("overdue")) {
    suggestions.push({ label: "Pipeline impact", action: "Are any deals impacted by overdue tasks?" });
  }
  if (lower.includes("meeting") || lower.includes("calendar")) {
    suggestions.push({ label: "Tasks due", action: "What tasks are due?" });
  }
  if (lower.includes("account") || lower.includes("contact") || lower.includes("company")) {
    suggestions.push({ label: "Pipeline", action: "Pipeline overview" });
    suggestions.push({ label: "Leads", action: "Show my leads" });
  }
  if (lower.includes("forecast") || lower.includes("revenue")) {
    suggestions.push({ label: "At-risk deals", action: "Show at-risk deals" });
    suggestions.push({ label: "Top deals", action: "Tell me about my top deals" });
  }

  // Always offer follow-ups
  if (suggestions.length === 0) {
    if (ctx.overdueTasksCount > 0) suggestions.push({ label: "Overdue tasks", action: "Show overdue tasks" });
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "At-risk deals", action: "Which deals are at risk?" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Stale leads", action: "Show stale leads" });
    if (suggestions.length === 0) suggestions.push({ label: "Overview", action: "Give me my daily overview" });
  }

  return suggestions.slice(0, 3);
}
