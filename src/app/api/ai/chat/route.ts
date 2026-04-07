import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";


// --- Web Search for Market Intelligence ---

async function searchWeb(query: string): Promise<string> {
  try {
    const res = await fetch(
      \`https://api.search.brave.com/res/v1/web/search?q=\${encodeURIComponent(query)}&count=5\`,
      {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY || "",
        },
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, 3);
    return results.map((r: any) => \`- \${r.title}: \${r.description}\`).join("\n");
  } catch {
    return "";
  }
}

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
  topOpportunities: DealInfo[];
  atRiskDeals: DealInfo[];
  pipelineTotal: number;
  activeDealsCount: number;
  atRiskDealsCount: number;
  allLeads: LeadInfo[];
  staleLeads: LeadInfo[];
  staleLeadsCount: number;
  totalLeadsCount: number;
  leadsByStatus: Record<string, number>;
  overdueTasks: TaskInfo[];
  upcomingTasks: TaskInfo[];
  overdueTasksCount: number;
  totalTasksCount: number;
  todayMeetings: MeetingInfo[];
  upcomingMeetings: MeetingInfo[];
  todayMeetingsCount: number;
  recentActivities: ActivityInfo[];
  recentActivitiesCount: number;
  accounts: AccountInfo[];
  totalAccountsCount: number;
  contacts: ContactInfo[];
  totalContactsCount: number;
  companies: CompanyInfo[];
  totalCompaniesCount: number;
  // CRE-specific
  commissions: any[];
  propertyComps: any[];
  dealDocuments: any[];
  totalCommissionsPending: number;
  totalCommissionsEarned: number;
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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dayMs = 1000 * 60 * 60 * 24;

  // Helper: safely run a query with a fallback value
  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try { return await fn(); } catch (e) { console.warn("[ai-ctx] query failed:", e); return fallback; }
  }

  const [
    commissionsRaw, propertyCompsRaw, dealDocumentsRaw,
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
    safe(() => prisma.opportunity.findMany({
      where: { organizationId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      orderBy: { value: "desc" },
      take: 10,
      select: { title: true, value: true, stage: true, probability: true, updatedAt: true },
    }), []),

    // ── Leads (all active, top 15) ──
    safe(() => prisma.lead.findMany({
      where: { organizationId, status: { notIn: ["CONVERTED", "UNQUALIFIED"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, email: true, status: true, temperature: true, fitScore: true, updatedAt: true, company: { select: { name: true } } },
    }), []),
    // Leads grouped by status
    safe(() => prisma.lead.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }), []),
    safe(() => prisma.lead.count({ where: { organizationId } }), 0),

    // ── Tasks (overdue) ──
    safe(() => prisma.task.findMany({
      where: { organizationId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { title: true, priority: true, status: true, dueDate: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }), []),
    // Upcoming tasks (next 7 days)
    safe(() => prisma.task.findMany({
      where: { organizationId, status: { not: "COMPLETED" }, dueDate: { gte: now, lt: nextWeek } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { title: true, priority: true, status: true, dueDate: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }), []),
    safe(() => prisma.task.count({ where: { organizationId, status: { not: "COMPLETED" } } }), 0),

    // ── Meetings (today) ──
    safe(() => prisma.meeting.findMany({
      where: { organizationId, startTime: { gte: todayStart, lt: todayEnd } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, attendees: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }), []),
    // Upcoming meetings (next 7 days)
    safe(() => prisma.meeting.findMany({
      where: { organizationId, startTime: { gte: todayEnd, lt: nextWeek } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, attendees: true, opportunity: { select: { title: true } }, lead: { select: { name: true } } },
    }), []),

    // ── Activities (recent) ──
    safe(() => prisma.activity.findMany({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { type: true, subject: true, channel: true, createdAt: true, leadId: true, opportunityId: true },
    }), []),
    safe(() => prisma.activity.count({ where: { organizationId, createdAt: { gte: sevenDaysAgo } } }), 0),

    // ── Accounts ──
    safe(() => prisma.account.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, status: true, isCustomer: true, onboardingStatus: true, company: { select: { name: true } } },
    }), []),
    safe(() => prisma.account.count({ where: { organizationId } }), 0),

    // ── Contacts ──
    safe(() => prisma.contact.findMany({
      where: { company: { organizationId } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, email: true, title: true, isChampion: true, isDecisionMaker: true, company: { select: { name: true } } },
    }), []),
    safe(() => prisma.contact.count({ where: { company: { organizationId } } }), 0),

    // ── Companies ──
    safe(() => prisma.company.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, industry: true, _count: { select: { contacts: true, leads: true, accounts: true } } },
    }), []),
    safe(() => prisma.company.count({ where: { organizationId } }), 0),
    // -- Commissions --
    safe(() => prisma.commission.findMany({
      where: { organizationId },
      include: { opportunity: { select: { title: true, value: true } } },
      take: 20,
    }), []),
    safe(() => prisma.propertyComp.findMany({
      where: { organizationId },
      orderBy: { closedDate: "desc" },
      take: 20,
    }), []),
    safe(() => prisma.dealDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { opportunity: { select: { title: true } } },
    }), []),
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
    // CRE-specific
    commissions: commissionsRaw,
    propertyComps: propertyCompsRaw,
    dealDocuments: dealDocumentsRaw,
    totalCommissionsPending: (commissionsRaw || []).filter((c: any) => (c as any).status !== "PAID" && (c as any).status !== "EARNED").reduce((s: number, c: any) => s + ((c as any).amount || 0), 0),
    totalCommissionsEarned: (commissionsRaw || []).filter((c: any) => (c as any).status === "PAID" || (c as any).status === "EARNED").reduce((s: number, c: any) => s + ((c as any).amount || 0), 0),
  };
}

function buildSystemPrompt(ctx: CRMContext, marketIntel?: string): string {
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
  const commissionsList = ctx.commissions.slice(0, 10)
    .map((c: any) => `- ${c.opportunity?.title || "N/A"}: ${formatCurrency(c.amount || 0)} (${c.status || "pending"})`)
    .join("\n");
  const compsList = ctx.propertyComps.slice(0, 10)
    .map((c: any) => `- ${c.address || c.name || "N/A"}: ${formatCurrency(c.salePrice || 0)} | ${c.propertyType || "N/A"} | ${c.capRate ? c.capRate + "% cap" : "N/A"} | ${c.closedDate ? new Date(c.closedDate).toISOString().split("T")[0] : "N/A"}`)
    .join("\n");
  const docsList = ctx.dealDocuments.slice(0, 10)
    .map((d: any) => `- ${d.name || d.type || "Doc"} → ${d.opportunity?.title || "N/A"} | status: ${d.status || "draft"} | ${d.createdAt ? new Date(d.createdAt).toISOString().split("T")[0] : ""}`)
    .join("\n");

  let prompt = `You are **Aexion AI** — Senior CRE Deal Advisor specialized in US Commercial Real Estate.

IDENTITY & CREDENTIALS:
- Name: Aexion AI — Senior CRE Deal Advisor
- 25+ years of experience in CRE investment sales, leasing, development
- Expert in cap rates, NOI analysis, lease structures, due diligence, 1031 exchanges
- Credentials: CCIM, SIOR, CRE, CPM
- Strategic advisor for the brokerage team using Aexion Core
- Thinks like a CCO (Chief Commercial Officer) who needs to hit quarterly targets
- Direct, strategic, always recommends the next concrete action
- ALWAYS responds in English
- Uses standard CRE terminology: cap rate, NOI, LOI, PSA, NNN, DSCR, etc.

CRE MARKET KNOWLEDGE — HARDCODED BENCHMARKS (2024-2026):

CAP RATE BENCHMARKS BY PROPERTY TYPE:
- Office (Class A): 6.0-7.5%
- Office (Class B): 7.5-9.0%
- Retail (Strip Center): 6.5-8.0%
- Retail (NNN Single Tenant): 5.0-6.5%
- Industrial (Warehouse): 5.0-6.5%
- Industrial (Flex): 6.0-7.5%
- Multifamily (Class A): 4.5-5.5%
- Multifamily (Class B/C): 5.5-7.0%
- Hospitality: 8.0-10.0%
- Mixed-Use: 5.5-7.5%

PRICE PER SQFT BENCHMARKS (Sun Belt Markets):
- Office: $150-$350/sqft
- Retail: $100-$300/sqft
- Industrial: $80-$200/sqft
- Multifamily: $150,000-$300,000/unit

KEY MARKETS (Sun Belt Growth):
- Austin TX: Tech-driven, strong multifamily, office softening post-COVID
- Miami FL: International capital, luxury multifamily, retail strong
- Nashville TN: Healthcare/music industry, industrial growing
- Phoenix AZ: Logistics hub, industrial booming, multifamily oversupply risk
- Dallas-Fort Worth TX: Corporate relocations, industrial corridor
- Charlotte NC: Banking sector, mixed-use development
- Tampa FL: Population growth, medical office strong
- Atlanta GA: Logistics/distribution hub, multifamily stable

DUE DILIGENCE STANDARD TIMELINE:
- Environmental Phase I: 2-3 weeks
- Title Search & Survey: 2-4 weeks
- Property Condition Assessment (PCA): 2-3 weeks
- Financial Audit (rent rolls, T-12, T-3): 1-2 weeks
- Zoning Verification: 1-2 weeks
- ALTA Survey: 3-4 weeks
- Estoppel Certificates: 2-4 weeks
- Total Standard DD Period: 30-60 days
- Extended DD (complex): 60-90 days

COMMISSION STANDARDS:
- Investment Sales: 1-3% of sale price (higher for smaller deals <$5M)
- Leasing (Landlord Rep): 4-6% of total lease value
- Leasing (Tenant Rep): 2-4% of total lease value
- Referral Fee: 20-35% of commission
- Typical Split: 50/50 to 70/30 (senior/junior)
- Co-Brokerage: typically 50/50 between listing and selling broker

DEAL VELOCITY BENCHMARKS:
- LOI to PSA: 7-14 days
- PSA to DD Complete: 30-60 days
- DD Complete to Closing: 15-30 days
- Total Cycle (Investment Sale): 60-120 days
- Total Cycle (Lease): 30-90 days
- LOI Response Time ideal: 48-72h

KEY FINANCIAL FORMULAS:
- Cap Rate = NOI / Purchase Price
- NOI = Effective Gross Income - Operating Expenses (excluding debt service)
- Price Per Unit = Purchase Price / Number of Units
- Price Per SF = Purchase Price / Total Rentable SF
- GRM (Gross Rent Multiplier) = Purchase Price / Annual Gross Rent
- Cash-on-Cash Return = Annual Pre-Tax Cash Flow / Total Cash Invested
- DSCR (Debt Service Coverage Ratio) = NOI / Annual Debt Service (minimum 1.25x)
- Break-Even Occupancy = (Operating Expenses + Debt Service) / Gross Potential Income
- Loan-to-Value (LTV) = Loan Amount / Appraised Value (typical 65-75% for CRE)
- Debt Yield = NOI / Loan Amount (minimum 8-10%)

LEASE STRUCTURES:
- NNN (Triple Net): Tenant pays taxes, insurance, CAM
- Modified Gross: Landlord pays base year expenses, tenant pays increases
- Full Service Gross: Landlord pays all, common in Class A office
- Percentage Rent: Base rent + % of sales above breakpoint (retail)
- Ground Lease: Tenant leases the land, builds improvements

CURRENT FINANCING TERMS (2024-2026):
- CMBS Rates: 6.0-7.5%
- Bank Loans: 6.5-8.0%
- Life Company: 5.5-6.5%
- Agency (Fannie/Freddie - Multifamily): 5.5-6.5%
- Bridge/Mezzanine: 8-12%
- Typical LTV: 60-75%
- Typical Amortization: 25-30 years

ANALYSIS CAPABILITIES — When analyzing deals, you MUST:
1. Compare deal metrics against the hardcoded benchmarks above
2. Flag deals where cap rate is below market (overvaluation risk)
3. Flag deals where occupancy is below 85% (critical threshold)
4. Calculate price/sqft and compare with market
5. Track DD timeline and flag upcoming deadlines
6. Calculate commission projection per deal
7. Identify concentration risk in portfolio
8. Analyze pipeline velocity vs benchmarks
9. Cross-reference between deals, tasks, contacts, and documents
10. Suggest financing structure based on deal profile

COMMUNICATION STYLE:
- Executive, direct tone — no fluff, no generic phrases
- ALWAYS lead with the most impactful insight (the "headline")
- Use **bold** for names, values, and key metrics
- ALWAYS end with an actionable recommendation or strategic question
- Maximum 4-6 sentences per response, unless the user asks for details
- NEVER say "I don't have data" — analyze what's available and suggest actions
- Use CRE terms inline: cap rate, NOI, LOI, PSA, NNN, DSCR, etc.
- Format values in USD: $18.5M, $250K

CRM DATA — REAL-TIME SNAPSHOT:

═══ PIPELINE (${ctx.activeDealsCount} active deals, ${formatCurrency(ctx.pipelineTotal)} total) ═══
${topDeals || "No active deals."}

═══ AT-RISK DEALS (probability < 40%): ${ctx.atRiskDealsCount} ═══
${atRiskDeals || "None — healthy pipeline."}

═══ LEADS (${ctx.totalLeadsCount} total | ${leadStatusLine}) ═══
${leadsList || "No active leads."}
Stale (30+ days without activity): ${ctx.staleLeadsCount}

═══ TASKS (${ctx.totalTasksCount} open) ═══
Overdue (${ctx.overdueTasksCount}):
${overdueTasksList || "None overdue."}
Next 7 days:
${upcomingTasksList || "None scheduled."}

═══ MEETINGS ═══
Today (${ctx.todayMeetingsCount}):
${todayMeetingsList || "No meetings today."}
Next 7 days:
${upcomingMeetingsList || "None scheduled."}

═══ ACCOUNTS (${ctx.totalAccountsCount} total) ═══
${accountsList || "No accounts."}

═══ CONTACTS (${ctx.totalContactsCount} total) ═══
${contactsList || "No contacts."}

═══ COMPANIES (${ctx.totalCompaniesCount} total) ═══
${companiesList || "No companies."}

═══ RECENT ACTIVITY (last 7 days: ${ctx.recentActivitiesCount}) ═══
${recentActivityList || "No recent activity."}

═══ COMMISSIONS (Pending: ${formatCurrency(ctx.totalCommissionsPending)} | Earned: ${formatCurrency(ctx.totalCommissionsEarned)}) ═══
${commissionsList || "No commissions recorded."}

═══ PROPERTY COMPS (${ctx.propertyComps.length} records) ═══
${compsList || "No comps recorded."}

═══ DEAL DOCUMENTS (${ctx.dealDocuments.length} records) ═══
${docsList || "No documents recorded."}

ABSOLUTE RULES:
1. ALWAYS respond in English
2. Use SPECIFIC NAMES, values, and real data — NEVER fabricate data
3. Format values in USD: $18.5M, $250K
4. Cross-reference data between entities: task + deal, lead + company, contact + account, commission + deal
5. Prioritize by financial impact and urgency
6. Be proactive: if you see a problem in the data, mention it even if the user didn't ask
7. Every response must end with a CONCRETE ACTION
8. Treat the user as a senior broker — they need strategic insights, not operational reports
9. When mentioning cap rates, ALWAYS compare with the benchmark for the corresponding property type
10. When mentioning deals, calculate estimated commission using the standards above
11. When mentioning DD timelines, compare with benchmarks and flag delays
12. Use market benchmarks to contextualize ANY number mentioned`;

  if (marketIntel) {
    prompt += `\n\n═══ MARKET INTELLIGENCE (live) ═══\n${marketIntel}`;
  }

  return prompt;
}

function generateRuleBasedResponse(message: string, ctx: CRMContext): ChatResponse {
  const lower = message.toLowerCase();
  const fmtStage = (s: string) => s.replace(/_/g, " ").toLowerCase();

  // ── Help / Capabilities ─────────────────────────────────────────────
  if (lower.includes("help") || lower.includes("what can you") || lower.includes("capabilit")) {
    return {
      message:
        "I have access to **all your CRM data** and act as your chief commercial officer specialized in CRE. I can help with:\n\n" +
        "• **Pipeline & Deals** — health analysis, at-risk deals, breakdown by stage and property type\n" +
        "• **Cap Rate & Valuation** — comparison with market benchmarks by property type\n" +
        "• **Comps & Market** — comparable analysis, market trends, Sun Belt insights\n" +
        "• **Commissions** — pending vs earned tracking, projections by deal\n" +
        "• **Due Diligence** — timeline tracking, deadlines, pending items\n" +
        "• **Documents** — LOI, PSA, NDA, and contract status\n" +
        "• **Leads** — cold leads, follow-up prioritization, qualification\n" +
        "• **Tasks** — overdue, upcoming this week, daily action plan\n" +
        "• **Meetings** — today's agenda, call prep\n" +
        "• **Accounts & Contacts** — champions, decision makers, account health\n" +
        "• **Portfolio** — concentration by property type, geographic distribution, risk\n" +
        "• **Forecast** — weighted projection, breakdown by stage, scenarios\n" +
        "• **Market Intelligence** — real-time web search for CRE trends and news\n\n" +
        "Ask me anything — I analyze with real data and market benchmarks.",
      suggestions: [
        { label: "Daily briefing", action: "Give me the daily briefing" },
        { label: "Cap Rate Analysis", action: "Analyze my deals cap rates" },
        { label: "Portfolio Overview", action: "Portfolio overview" },
      ],
    };
  }

  // ── Cap Rate Analysis ──────────────────────────────────────────────
  if (lower.includes("cap rate") || lower.includes("caprate") || lower.includes("capitalization")) {
    let msg = "**Cap Rate Analysis — Aexion Portfolio**\n\n";
    if (ctx.topOpportunities.length > 0) {
      msg += "**Active deals vs market benchmarks:**\n";
      for (const deal of ctx.topOpportunities) {
        msg += `  • **${deal.title}** — ${formatCurrency(deal.value)} | ${fmtStage(deal.stage)} | ${deal.probability}% prob\n`;
      }
      msg += "\n";
    }
    msg += "**Market benchmarks (2024-2026):**\n";
    msg += "  • Office (Class A): 6.0-7.5% | Office (Class B): 7.5-9.0%\n";
    msg += "  • Retail (NNN): 5.0-6.5% | Strip Center: 6.5-8.0%\n";
    msg += "  • Industrial (Warehouse): 5.0-6.5% | Flex: 6.0-7.5%\n";
    msg += "  • Multifamily (A): 4.5-5.5% | (B/C): 5.5-7.0%\n";
    msg += "  • Hospitality: 8.0-10.0% | Mixed-Use: 5.5-7.5%\n\n";
    if (ctx.propertyComps.length > 0) {
      msg += `**Recent comps (${ctx.propertyComps.length}):**\n`;
      for (const comp of ctx.propertyComps.slice(0, 5)) {
        const c = comp as any;
        msg += `  • ${c.address || c.name || "N/A"}: ${formatCurrency(c.salePrice || 0)}${c.capRate ? ` | ${c.capRate}% cap` : ""}${c.propertyType ? ` | ${c.propertyType}` : ""}\n`;
      }
      msg += "\n";
    }
    msg += "**Recommendation:** Compare each active deal against the corresponding property type benchmarks. Cap rate below range indicates overvaluation — renegotiate or reassess. Above range may be a value opportunity.";
    return {
      message: msg,
      suggestions: [
        { label: "Detailed comps", action: "Show my comparables" },
        { label: "Pipeline", action: "Pipeline" },
        { label: "Forecast", action: "Revenue forecast" },
      ],
    };
  }

  // ── Comp Analysis ──────────────────────────────────────────────────
  if (lower.includes("comp") || lower.includes("comparable")) {
    let msg = "**Comparable Analysis (Comps)**\n\n";
    if (ctx.propertyComps.length > 0) {
      msg += `**${ctx.propertyComps.length} comps in database:**\n`;
      for (const comp of ctx.propertyComps.slice(0, 10)) {
        const c = comp as any;
        msg += `  • **${c.address || c.name || "N/A"}**: ${formatCurrency(c.salePrice || 0)}`;
        if (c.capRate) msg += ` | Cap: ${c.capRate}%`;
        if (c.propertyType) msg += ` | ${c.propertyType}`;
        if (c.squareFeet) msg += ` | ${c.squareFeet.toLocaleString()} sqft ($${((c.salePrice || 0) / c.squareFeet).toFixed(0)}/sqft)`;
        if (c.closedDate) msg += ` | Closed: ${new Date(c.closedDate).toISOString().split("T")[0]}`;
        msg += "\n";
      }
      msg += "\n**Recommendation:** Use comps to validate pricing on active deals. A deal priced above comps = red flag for negotiation.";
    } else {
      msg += "No comps recorded yet.\n\n";
      msg += "**Reference benchmarks (Sun Belt):**\n";
      msg += "  • Office: $150-$350/sqft | Retail: $100-$300/sqft\n";
      msg += "  • Industrial: $80-$200/sqft | Multifamily: $150K-$300K/unit\n\n";
      msg += "**Action:** Start recording comps from deals you analyze. A comp database is the most valuable asset for a CRE broker.";
    }
    return {
      message: msg,
      suggestions: [
        { label: "Cap Rates", action: "Cap rate analysis" },
        { label: "Market trends", action: "CRE market trends" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Commission Tracking ────────────────────────────────────────────
  if (lower.includes("commission") || lower.includes("split") || (lower.includes("fee") && !lower.includes("coffee"))) {
    let msg = "**Tracking de Commissions**\n\n";
    msg += `**Summary:**\n`;
    msg += `  • Earned/Paid: **${formatCurrency(ctx.totalCommissionsEarned)}**\n`;
    msg += `  • Pending: **${formatCurrency(ctx.totalCommissionsPending)}**\n`;
    msg += `  • Total: **${formatCurrency(ctx.totalCommissionsEarned + ctx.totalCommissionsPending)}**\n\n`;
    if (ctx.commissions.length > 0) {
      msg += `**Breakdown (${ctx.commissions.length} records):**\n`;
      for (const comm of ctx.commissions.slice(0, 10)) {
        const c = comm as any;
        msg += `  • **${c.opportunity?.title || "N/A"}**: ${formatCurrency(c.amount || 0)} — ${c.status || "pending"}\n`;
      }
      msg += "\n";
    }
    if (ctx.topOpportunities.length > 0) {
      msg += "**Pipeline projection (est. 2% investment sales):**\n";
      let totalProjected = 0;
      for (const deal of ctx.topOpportunities.slice(0, 5)) {
        const est = deal.value * 0.02;
        const weighted = est * (deal.probability / 100);
        totalProjected += weighted;
        msg += `  • **${deal.title}**: ${formatCurrency(est)} gross (weighted: ${formatCurrency(weighted)} @ ${deal.probability}%)\n`;
      }
      msg += `\n  **Total projected (weighted): ${formatCurrency(totalProjected)}**\n\n`;
    }
    msg += "**Standards:** Investment Sales: 1-3% | Leasing (Landlord): 4-6% | Leasing (Tenant): 2-4% | Referral: 20-35%\n\n";
    msg += "**Action:** Verify all commissions are recorded with splits. Commission leakage is the costliest mistake in CRE brokerage.";
    return {
      message: msg,
      suggestions: [
        { label: "Pipeline", action: "Pipeline" },
        { label: "Forecast", action: "Revenue forecast" },
        { label: "At-risk deals", action: "At-risk deals" },
      ],
    };
  }

  // ── Due Diligence Tracker ──────────────────────────────────────────
  if (lower.includes("due diligence") || lower.includes(" dd ") || lower === "dd") {
    let msg = "**Tracker de Due Diligence**\n\n";
    const ddDeals = ctx.topOpportunities.filter((d) =>
      d.stage.toLowerCase().includes("due_diligence") || d.stage.toLowerCase().includes("dd") ||
      d.stage.toLowerCase().includes("negotiation") || d.stage.toLowerCase().includes("contract")
    );
    if (ddDeals.length > 0) {
      msg += `**${ddDeals.length} deal(s) in DD/Negotiation phase:**\n`;
      for (const deal of ddDeals) {
        msg += `  • **${deal.title}** — ${formatCurrency(deal.value)} | ${fmtStage(deal.stage)} | ${deal.daysInStage}d in stage\n`;
        if (deal.daysInStage > 60) msg += `    ALERT: ${deal.daysInStage} days — exceeds 30-60 days\n`;
        else if (deal.daysInStage > 45) msg += `    WARNING: ${deal.daysInStage} days — approaching limit\n`;
      }
      msg += "\n";
    } else {
      msg += "No deals identified in DD/Negotiation stage.\n\n";
    }
    const ddTasks = [...ctx.overdueTasks, ...ctx.upcomingTasks].filter((t) =>
      t.title.toLowerCase().includes("dd") || t.title.toLowerCase().includes("diligence") ||
      t.title.toLowerCase().includes("environmental") || t.title.toLowerCase().includes("title") ||
      t.title.toLowerCase().includes("survey") || t.title.toLowerCase().includes("inspection") ||
      t.title.toLowerCase().includes("appraisal") || t.title.toLowerCase().includes("zoning")
    );
    if (ddTasks.length > 0) {
      msg += `**DD-related tasks (${ddTasks.length}):**\n`;
      for (const task of ddTasks.slice(0, 5)) {
        const status = task.daysOverdue > 0 ? `${task.daysOverdue}d overdue` : `due ${task.dueDate}`;
        msg += `  • **${task.title}** [${task.priority}] — ${status}${task.relatedTo ? ` → ${task.relatedTo}` : ""}\n`;
      }
      msg += "\n";
    }
    if (ctx.dealDocuments.length > 0) {
      msg += `**Documents in progress (${ctx.dealDocuments.length}):**\n`;
      for (const doc of ctx.dealDocuments.slice(0, 5)) {
        const d = doc as any;
        msg += `  • **${d.name || d.type || "Doc"}** → ${d.opportunity?.title || "N/A"} | status: ${d.status || "draft"}\n`;
      }
      msg += "\n";
    }
    msg += "**Reference timeline:** Environmental Phase I: 2-3 wks | Title & Survey: 2-4 wks | PCA: 2-3 wks | Financial Audit: 1-2 wks | Total: 30-60 days\n\n";
    msg += "**Action:** Review each deal in DD against this timeline. Delays in Environmental or Title are the most critical.";
    return {
      message: msg,
      suggestions: [
        { label: "Documents", action: "Document status" },
        { label: "Overdue tasks", action: "Overdue tasks" },
        { label: "At-risk deals", action: "At-risk deals" },
      ],
    };
  }

  // ── Market Analysis ────────────────────────────────────────────────
  if (lower.includes("market") || lower.includes("benchmark") || lower.includes("trend")) {
    let msg = "**CRE Market Analysis — Benchmarks & Trends**\n\n";
    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
    }
    if (Object.keys(stageBreakdown).length > 0) {
      msg += "**Portfolio by stage:**\n";
      for (const [stage, data] of Object.entries(stageBreakdown)) {
        msg += `  • ${stage}: ${data.count} deal(s) — ${formatCurrency(data.value)}\n`;
      }
      msg += "\n";
    }
    const highProb = ctx.topOpportunities.filter((d) => d.probability >= 60);
    const lowProb = ctx.topOpportunities.filter((d) => d.probability < 40);
    msg += "**Pipeline health:**\n";
    msg += `  • High probability (>=60%): ${highProb.length}/${ctx.activeDealsCount}\n`;
    msg += `  • Low probability (<40%): ${lowProb.length}/${ctx.activeDealsCount}\n`;
    msg += `  • Total pipeline: ${formatCurrency(ctx.pipelineTotal)}\n\n`;
    msg += "**Sun Belt Benchmarks (2024-2026):**\n";
    msg += "  • Cap Rates compressing in Industrial (5.0-6.5%) — high logistics demand\n";
    msg += "  • Office in post-COVID adjustment — Class B suffers most (7.5-9.0%)\n";
    msg += "  • Multifamily oversupply in Phoenix/Austin — caution on new deals\n";
    msg += "  • NNN Retail stabilizing — safe yield (5.0-6.5%)\n";
    msg += "  • Industrial/Logistics most resilient — faster deal velocity\n\n";
    msg += "**Interest rates:** CMBS: 6.0-7.5% | Bank: 6.5-8.0% | Agency: 5.5-6.5%\n";
    msg += "Minimum DSCR of 1.25x eliminating marginal deals. Refinancing gap creating distressed asset opportunities.\n\n";
    msg += "**Recommendation:** Focus on Industrial and NNN Retail for faster deal velocity. Avoid Office Class B without significant discount. Monitor distressed assets over the next 12-18 months.";
    return {
      message: msg,
      suggestions: [
        { label: "Cap Rates", action: "Cap rate analysis" },
        { label: "Comps", action: "My comparables" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Property Analysis ──────────────────────────────────────────────
  if (lower.includes("property") || lower.includes("noi") || lower.includes("occupancy")) {
    let msg = "**Property Analysis — CRE Metrics**\n\n";
    if (ctx.topOpportunities.length > 0) {
      msg += "**Active deals with metrics:**\n";
      for (const deal of ctx.topOpportunities) {
        const estComm = deal.value * 0.02;
        msg += `\n  **${deal.title}** — ${formatCurrency(deal.value)}\n`;
        msg += `  • Stage: ${fmtStage(deal.stage)} | Prob: ${deal.probability}% | ${deal.daysInStage}d in stage\n`;
        msg += `  • Estimated commission (2%): ${formatCurrency(estComm)}\n`;
        msg += deal.daysInStage > 30
          ? `  • Velocity: ${deal.daysInStage}d — above benchmark. Stalling risk.\n`
          : `  • Velocity: ${deal.daysInStage}d — within benchmark.\n`;
      }
      msg += "\n";
    }
    if (ctx.propertyComps.length > 0) {
      msg += `**Reference comps (${ctx.propertyComps.length}):**\n`;
      for (const comp of ctx.propertyComps.slice(0, 3)) {
        const c = comp as any;
        msg += `  • ${c.address || c.name || "N/A"}: ${formatCurrency(c.salePrice || 0)}${c.capRate ? ` | Cap: ${c.capRate}%` : ""}\n`;
      }
      msg += "\n";
    }
    msg += "**Key formulas:** Cap Rate = NOI / Price | DSCR = NOI / Debt Service (min 1.25x) | Break-Even Occ = (OpEx + Debt) / GPI\n\n";
    msg += "**Action:** For complete analysis, I need: NOI, asking price, property type, sqft, and occupancy.";
    return {
      message: msg,
      suggestions: [
        { label: "Cap Rates", action: "Cap rate analysis" },
        { label: "Comps", action: "Comparables" },
        { label: "DD Tracker", action: "Due diligence status" },
      ],
    };
  }

  // ── Document Status ────────────────────────────────────────────────
  if (lower.includes("document") || lower.includes("loi") || lower.includes("psa") || lower.includes("nda") || lower.includes("contract")) {
    let msg = "**Status de Documentos — Pipeline Documental**\n\n";
    if (ctx.dealDocuments.length > 0) {
      const byStatus: Record<string, any[]> = {};
      for (const doc of ctx.dealDocuments) {
        const status = (doc as any).status || "draft";
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(doc);
      }
      for (const [status, docs] of Object.entries(byStatus)) {
        msg += `**${status.toUpperCase()} (${docs.length}):**\n`;
        for (const doc of docs.slice(0, 5)) {
          const d = doc as any;
          msg += `  • **${d.name || d.type || "Doc"}** → ${d.opportunity?.title || "N/A"}`;
          if (d.createdAt) msg += ` | ${new Date(d.createdAt).toISOString().split("T")[0]}`;
          if (d.expiresAt) {
            const daysToExpiry = Math.floor((new Date(d.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysToExpiry < 0) msg += ` | EXPIRED ${Math.abs(daysToExpiry)}d`;
            else if (daysToExpiry < 7) msg += ` | Expires in ${daysToExpiry}d`;
          }
          msg += "\n";
        }
        msg += "\n";
      }
    } else {
      msg += "No documents recorded in the system.\n\n";
    }
    msg += "**CRE document pipeline:** 1. NDA/CA → 2. LOI (non-binding) → 3. PSA (binding, initiates DD) → 4. Amendments → 5. Closing Docs\n\n";
    msg += "**Action:** Check pending LOIs — benchmark response time is 48-72h. LOI without response in 5+ days is a red flag.";
    return {
      message: msg,
      suggestions: [
        { label: "DD Tracker", action: "Due diligence status" },
        { label: "At-risk deals", action: "At-risk deals" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Portfolio Overview ─────────────────────────────────────────────
  if (lower.includes("portfolio") || lower.includes("overview")) {
    let msg = "**Portfolio Overview — Aexion Core**\n\n";
    msg += `**Pipeline Total: ${formatCurrency(ctx.pipelineTotal)}** (${ctx.activeDealsCount} active deals)\n\n`;
    const stageBreakdown: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0, weighted: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
      stageBreakdown[stage].weighted += o.value * (o.probability / 100);
    }
    if (Object.keys(stageBreakdown).length > 0) {
      msg += "**Breakdown by stage:**\n";
      for (const [stage, data] of Object.entries(stageBreakdown)) {
        const pct = ctx.pipelineTotal > 0 ? ((data.value / ctx.pipelineTotal) * 100).toFixed(0) : "0";
        msg += `  • ${stage}: ${data.count} deal(s) — ${formatCurrency(data.value)} (${pct}%) | Weighted: ${formatCurrency(data.weighted)}\n`;
      }
      msg += "\n";
    }
    const wP = ctx.topOpportunities.reduce((s, o) => s + o.value * (o.probability / 100), 0);
    msg += `**Commissions:** Earned: ${formatCurrency(ctx.totalCommissionsEarned)} | Pending: ${formatCurrency(ctx.totalCommissionsPending)} | Projected (2% weighted): ${formatCurrency(wP * 0.02)}\n\n`;
    msg += `**Risk:** ${ctx.atRiskDealsCount} at-risk deals | ${ctx.overdueTasksCount} overdue tasks | ${ctx.staleLeadsCount} cold leads\n`;
    msg += `**Operations:** ${ctx.totalContactsCount} contacts · ${ctx.totalAccountsCount} accounts · ${ctx.totalCompaniesCount} companies · ${ctx.totalLeadsCount} leads\n`;
    if (ctx.propertyComps.length > 0) msg += `**Comps:** ${ctx.propertyComps.length} in database | **Docs:** ${ctx.dealDocuments.length} in progress\n`;
    if (ctx.topOpportunities.length > 0) {
      const sorted = [...ctx.topOpportunities].sort((a, b) => b.value - a.value);
      const concPct = ctx.pipelineTotal > 0 ? ((sorted[0].value / ctx.pipelineTotal) * 100).toFixed(0) : "0";
      if (Number(concPct) > 40) msg += `\n**Concentration:** **${sorted[0].title}** = ${concPct}% of pipeline — high risk if this deal falls through.\n`;
    }
    msg += "\n**Recommendation:** Diversify the pipeline by property type and geography. Concentration > 30% in a single deal is excessive risk.";
    return {
      message: msg,
      suggestions: [
        { label: "Market trends", action: "Market trends" },
        { label: "Cap Rates", action: "Cap rate analysis" },
        { label: "Commissions", action: "My commissions" },
      ],
    };
  }

  // ── Leads ────────────────────────────────────────────────────────────
  if (lower.includes("lead") || lower.includes("leads") || lower.includes("stale") || lower.includes("cold") || lower.includes("prospecting")) {
    if (ctx.staleLeadsCount === 0 && ctx.allLeads.length === 0) {
      return {
        message: "No active leads at the moment. Time to prospect — want me to analyze the pipeline to identify opportunities?",
        suggestions: [{ label: "Pipeline", action: "Analyze my pipeline" }, { label: "Companies", action: "Show my companies" }],
      };
    }
    const hotLeads = ctx.allLeads.filter((l) => l.temperature === "HOT" || l.fitScore >= 70);
    const coldLeads = ctx.staleLeads;
    let msg = `**Strategic lead overview** — ${ctx.totalLeadsCount} total in CRM:\n\n`;
    if (hotLeads.length > 0) {
      msg += `**Hot leads (${hotLeads.length}):**\n`;
      msg += hotLeads.slice(0, 3).map((l) => `  • **${l.name}** (${l.company}) — fit ${l.fitScore}/100, ${l.temperature.toLowerCase()}, ${fmtStage(l.status)}`).join("\n") + "\n\n";
    }
    if (coldLeads.length > 0) {
      msg += `**Cold leads (${coldLeads.length}):**\n`;
      msg += coldLeads.slice(0, 3).map((l) => `  • **${l.name}** (${l.company}) — ${l.daysSinceUpdate} days without contact`).join("\n") + "\n\n";
    }
    const statusLine = Object.entries(ctx.leadsByStatus).map(([s, c]) => `${fmtStage(s)}: ${c}`).join(" · ");
    msg += `**Status:** ${statusLine}\n\n`;
    if (coldLeads.length > 0) {
      msg += `**Recommendation:** Prioritize **${coldLeads[0]?.name}** (${coldLeads[0]?.daysSinceUpdate} days idle). In CRE, timing is everything — the deal may already be with another broker.`;
    } else if (hotLeads.length > 0) {
      msg += `**Recommendation:** **${hotLeads[0]?.name}** tem fit score de ${hotLeads[0]?.fitScore} — hora de agendar uma call e enviar LOI.`;
    } else {
      msg += "**Recommendation:** Envie um comp report ou market update como touch point para nutrir seus leads.";
    }
    return {
      message: msg,
      suggestions: [
        { label: "Re-engajamento", action: "Plano de re-engajamento para leads frios" },
        { label: "Pipeline", action: "How is my pipeline?" },
        { label: "Market trends", action: "Market trends" },
      ],
    };
  }

  // ── Deals em Risco ──────────────────────────────────────────────────
  if (lower.includes("risco") || lower.includes("risk") || lower.includes("at-risk") || lower.includes("perigo") || lower.includes("travad")) {
    if (ctx.atRiskDealsCount === 0) {
      return {
        message: `Good news — no at-risk deals. All ${ctx.activeDealsCount} active deals >= 40% prob. Healthy pipeline at **${formatCurrency(ctx.pipelineTotal)}**.`,
        suggestions: [{ label: "Pipeline", action: "Pipeline completo" }, { label: "Forecast", action: "Revenue forecast" }],
      };
    }
    const dealList = ctx.atRiskDeals.sort((a, b) => b.value - a.value)
      .map((d) => `  • **${d.title}** — ${formatCurrency(d.value)} | ${d.probability}% | ${fmtStage(d.stage)} | ${d.daysInStage}d`).join("\n");
    const totalAtRisk = ctx.atRiskDeals.reduce((s, d) => s + d.value, 0);
    const estComm = totalAtRisk * 0.02;
    const stuckDeals = ctx.atRiskDeals.filter((d) => d.daysInStage > 14);
    const biggest = ctx.atRiskDeals.sort((a, b) => b.value - a.value)[0];
    let msg = `**${ctx.atRiskDealsCount} at-risk deals** — ${formatCurrency(totalAtRisk)} em jogo (est. ${formatCurrency(estComm)} em commissions):\n\n${dealList}\n\n`;
    if (stuckDeals.length > 0) msg += `• ${stuckDeals.length} deal(s) stuck 2+ weeks — a stalled deal is a dying deal in CRE.\n`;
    if (biggest) msg += `• **${biggest.title}** is the largest at risk — recommend escalating with an executive call.\n`;
    msg += `\n**Action:** Aggressive follow-ups. No response 48h after LOI? Change approach — go through the other side's broker.`;
    return {
      message: msg,
      suggestions: [
        { label: "Priorizar", action: "Priorizar at-risk deals" },
        { label: "Pipeline", action: "Pipeline completo" },
        { label: "DD Status", action: "Due diligence status" },
      ],
    };
  }

  // ── Pipeline / Deals ────────────────────────────────────────────────
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity") || ) {
    const dealBreakdown = ctx.topOpportunities.map((d) => `  • **${d.title}** — ${formatCurrency(d.value)} | ${fmtStage(d.stage)} | ${d.probability}% | ${d.daysInStage}d`).join("\n");
    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
    }
    const stageStr = Object.entries(stageBreakdown).map(([s, d]) => `${s}: ${d.count} (${formatCurrency(d.value)})`).join(" · ");
    const estComm = ctx.pipelineTotal * 0.02;
    let msg = `**Pipeline: ${formatCurrency(ctx.pipelineTotal)}** — ${ctx.activeDealsCount} deals | Est. commission (2%): ${formatCurrency(estComm)}\n\n`;
    msg += `**Top deals:**\n${dealBreakdown || "No active deals."}\n\n**By stage:** ${stageStr}\n\n`;
    if (ctx.atRiskDealsCount > 0) {
      msg += `**Warning:** ${ctx.atRiskDealsCount} deal(s) at risk (< 40% prob). Immediate action needed.`;
    } else {
      msg += "Healthy pipeline — focus on accelerating DD and closing on advanced deals.";
    }
    return {
      message: msg,
      suggestions: [
        ...(ctx.atRiskDealsCount > 0 ? [{ label: "At-risk deals", action: "At-risk deals" }] : []),
        { label: "Forecast", action: "Revenue forecast" },
        { label: "Commissions", action: "My commissions" },
      ],
    };
  }

  // ── Tasks ───────────────────────────────────────────────────────────
  if (lower.includes("task") || lower.includes("overdue") || lower.includes("to-do") || lower.includes("todo")) {
    if (ctx.overdueTasksCount === 0 && ctx.upcomingTasks.length === 0) {
      return {
        message: `All caught up — no overdue tasks. ${ctx.totalTasksCount > 0 ? `${ctx.totalTasksCount} open total.` : ""} Time to prospect.`,
        suggestions: [{ label: "Pipeline", action: "Pipeline" }, { label: "Leads", action: "My leads" }],
      };
    }
    let msg = "";
    if (ctx.overdueTasksCount > 0) {
      const taskList = ctx.overdueTasks
        .sort((a, b) => { const p: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }; return (p[b.priority] || 0) - (p[a.priority] || 0); })
        .slice(0, 5).map((t) => `  • **${t.title}** [${t.priority}] — ${t.daysOverdue}d overdue${t.relatedTo ? ` → ${t.relatedTo}` : ""}`).join("\n");
      msg += `**${ctx.overdueTasksCount} task(s) atrasada(s):**\n${taskList}\n\n`;
    }
    if (ctx.upcomingTasks.length > 0) {
      msg += `**Upcoming this week:**\n`;
      msg += ctx.upcomingTasks.slice(0, 3).map((t) => `  • **${t.title}** [${t.priority}] — due ${t.dueDate}${t.relatedTo ? ` → ${t.relatedTo}` : ""}`).join("\n") + "\n\n";
    }
    const linked = ctx.overdueTasks.filter((t) => t.relatedTo);
    msg += linked.length > 0
      ? `**Impacto:** ${linked.length} task(s) vinculada(s) a deals. Em CRE, atraso em DD/follow-up = perder janela de closing.`
      : "**Recommendation:** Resolve overdue tasks before new deals. In CRE, lost momentum is a lost deal.";
    return {
      message: msg,
      suggestions: [
        { label: "Briefing", action: "What should I focus on today?" },
        { label: "DD Status", action: "Due diligence status" },
        ...(ctx.staleLeadsCount > 0 ? [{ label: "Cold leads", action: "Cold leads" }] : []),
      ],
    };
  }

  // ── Meetings ────────────────────────────────────────────────────────
  if (lower.includes("meeting") || lower.includes("agenda") || lower.includes("calendar") || lower.includes("schedule")) {
    let msg = "";
    if (ctx.todayMeetings.length > 0) {
      msg += `**Meetings de hoje (${ctx.todayMeetingsCount}):**\n`;
      msg += ctx.todayMeetings.map((m) => `  • **${m.startTime}** — ${m.title}${m.relatedTo ? ` (${m.relatedTo})` : ""} | ${m.attendees}`).join("\n") + "\n\n";
    } else msg += "No meetings scheduled for today.\n\n";
    if (ctx.upcomingMeetings.length > 0) {
      msg += `**Upcoming this week:**\n` + ctx.upcomingMeetings.slice(0, 5).map((m) => `  • ${m.title}${m.relatedTo ? ` → ${m.relatedTo}` : ""}`).join("\n") + "\n\n";
    }
    msg += ctx.todayMeetings.length > 0
      ? `**CRE prep:** Before the call: review market comps, cap rate benchmarks for the property type, and have the T-12 ready.`
      : "**Opportunity:** Calendar is clear — use it for follow-ups, pending LOIs, and DD review.";
    return {
      message: msg,
      suggestions: [{ label: "At-risk deals", action: "At-risk deals" }, { label: "Tasks", action: "Pending tasks" }, { label: "DD Status", action: "Due diligence status" }],
    };
  }

  // ── Accounts ────────────────────────────────────────────────────────
  if (lower.includes("account") || lower.includes("conta") || lower.includes("customer") || lower.includes("cliente") || lower.includes("onboarding")) {
    const customers = ctx.accounts.filter((a) => a.isCustomer);
    const list = ctx.accounts.slice(0, 8).map((a) => `  • **${a.name}** (${a.company}) — ${a.status}${a.isCustomer ? " cliente" : ""}${a.onboardingStatus !== "PENDING" ? ` | onboarding: ${fmtStage(a.onboardingStatus)}` : ""}`).join("\n");
    return {
      message: `**${ctx.totalAccountsCount} accounts** (${customers.length} customer(s)):\n\n${list || "None."}\n${ctx.totalAccountsCount > 8 ? `  ...and more ${ctx.totalAccountsCount - 8}.\n` : ""}\n**CRE insight:** The first 90 days determine whether the client gives you the next listing or goes to another broker.`,
      suggestions: [{ label: "Contacts", action: "Key contacts" }, { label: "Companies", action: "Companies" }, { label: "Commissions", action: "Commissions" }],
    };
  }

  // ── Contatos ────────────────────────────────────────────────────────
  if (lower.includes("contact") || lower.includes("champion") || lower.includes("decision maker") || ) {
    const champions = ctx.contacts.filter((c) => c.isChampion);
    const dms = ctx.contacts.filter((c) => c.isDecisionMaker);
    const list = ctx.contacts.slice(0, 8).map((c) => `  • **${c.name}** (${c.company})${c.title ? ` — ${c.title}` : ""}${c.isChampion ? " ★champion" : ""}${c.isDecisionMaker ? " ★decisor" : ""}`).join("\n");
    let msg = `**${ctx.totalContactsCount} contatos** (${champions.length} champion(s), ${dms.length} decisor(es)):\n\n${list || "None."}\n${ctx.totalContactsCount > 8 ? `  ...and more ${ctx.totalContactsCount - 8}.\n` : ""}\n`;
    msg += champions.length > 0
      ? `**CRE strategy:** **${champions[0].name}** is your champion. In CRE, the champion convinces the investment committee. Keep warm with check-ins and market updates.`
      : "**Alert:** No champion identified. Without an internal advocate, deal velocity drops 60%.";
    return { message: msg, suggestions: [{ label: "Accounts", action: "Accounts" }, { label: "Companies", action: "Companies" }, { label: "Pipeline", action: "Pipeline" }] };
  }

  // ── Empresas ────────────────────────────────────────────────────────
  if (lower.includes("company") || lower.includes("companies") || lower.includes("organization")) {
    const list = ctx.companies.slice(0, 8).map((c) => `  • **${c.name}**${c.industry ? ` (${c.industry})` : ""} — ${c.contactsCount} contatos, ${c.leadsCount} leads, ${c.accountsCount} accounts`).join("\n");
    const noLeads = ctx.companies.filter((c) => c.leadsCount === 0 && c.accountsCount === 0);
    let msg = `**${ctx.totalCompaniesCount} company(ies):**\n\n${list || "None."}\n${ctx.totalCompaniesCount > 8 ? `  ...and more ${ctx.totalCompaniesCount - 8}.\n` : ""}\n`;
    msg += noLeads.length > 0
      ? `**CRE opportunity:** ${noLeads.length} company(ies) sem leads/accounts. Reative com market report ou comp analysis.`
      : "All have linked leads/accounts. Want analysis of a specific one?";
    return { message: msg, suggestions: [{ label: "Contatos", action: "Contatos" }, { label: "Accounts", action: "Accounts" }, { label: "Portfolio", action: "Portfolio overview" }] };
  }

  // ── Atividades ──────────────────────────────────────────────────────
  if (lower.includes("activit") || lower.includes("history") || lower.includes("engagement")) {
    const list = ctx.recentActivities.slice(0, 5).map((a) => `  • [${a.createdAt}] **${a.type}**${a.subject ? `: ${a.subject}` : ""}${a.channel ? ` (${a.channel})` : ""}`).join("\n");
    return {
      message: `**${ctx.recentActivitiesCount} activities** (7 days):\n\n${list || "None."}\n${ctx.recentActivitiesCount > 5 ? `  ...and more ${ctx.recentActivitiesCount - 5}.\n` : ""}\n` +
        (ctx.recentActivitiesCount < 10
          ? "**CRE alert:** Low volume. Every deal needs 2-3 weekly touchpoints. Deals without activity for 7+ days go cold — especially during DD."
          : "**Good pace!** In CRE, follow-up consistency separates top producers from the rest."),
      suggestions: [{ label: "Cold leads", action: "Cold leads" }, { label: "DD Status", action: "Due diligence status" }, { label: "Pipeline", action: "Pipeline" }],
    };
  }

  // ── Forecast ────────────────────────────────────────────────────────
  if (lower.includes("forecast") || lower.includes("revenue") || lower.includes("projection")) {
    const wP = ctx.topOpportunities.reduce((s, o) => s + o.value * (o.probability / 100), 0);
    const stageBreakdown: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0, weighted: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
      stageBreakdown[stage].weighted += o.value * (o.probability / 100);
    }
    const breakdown = Object.entries(stageBreakdown).map(([s, d]) => `  • **${s}:** ${d.count} deal(s) — ${formatCurrency(d.value)} (pond: ${formatCurrency(d.weighted)})`).join("\n");
    const conv = ctx.pipelineTotal > 0 ? ((wP / ctx.pipelineTotal) * 100).toFixed(0) : "0";
    const estComm = wP * 0.02;
    return {
      message: `**Weighted forecast: ${formatCurrency(wP)}**\nPipeline: ${formatCurrency(ctx.pipelineTotal)} | ${ctx.activeDealsCount} deals | Conversion: ${conv}%\nEstimated commission (2%): **${formatCurrency(estComm)}**\n\n**By stage:**\n${breakdown || "No data."}\n\n` +
        `**Commissions atuais:** Earned: ${formatCurrency(ctx.totalCommissionsEarned)} | Pending: ${formatCurrency(ctx.totalCommissionsPending)}\n\n` +
        (ctx.atRiskDealsCount > 0
          ? `**Risk:** ${ctx.atRiskDealsCount} deal(s) < 40% puxando o forecast. Melhorar pode adicionar **${formatCurrency(ctx.atRiskDeals.reduce((s, d) => s + d.value * 0.3, 0))}**.`
          : "**Healthy pipeline.** Focus on accelerating advanced deals. Benchmark: 60-120 days for investment sale."),
      suggestions: [{ label: "At-risk deals", action: "At-risk deals" }, { label: "Commissions", action: "Commissions" }, { label: "Portfolio", action: "Portfolio overview" }],
    };
  }

  // ── Default: Briefing Executivo CRE ─────────────────────────────────
  let overview = "**Briefing executivo CRE, Thiago:**\n\n";
  overview += `**Pipeline:** ${formatCurrency(ctx.pipelineTotal)} em ${ctx.activeDealsCount} deals`;
  if (ctx.atRiskDealsCount > 0) overview += ` (${ctx.atRiskDealsCount} em risco)`;
  overview += ` | Est. commission: ${formatCurrency(ctx.pipelineTotal * 0.02)}\n`;
  if (ctx.overdueTasksCount > 0) {
    overview += `**${ctx.overdueTasksCount} task(s) atrasada(s)**`;
    if (ctx.overdueTasks[0]) overview += ` — urgente: ${ctx.overdueTasks[0].title} (${ctx.overdueTasks[0].daysOverdue}d)`;
    overview += "\n";
  }
  if (ctx.staleLeadsCount > 0) overview += `**${ctx.staleLeadsCount} cold lead(s)**\n`;
  if (ctx.todayMeetingsCount > 0) {
    overview += `**${ctx.todayMeetingsCount} meeting(s) today**`;
    if (ctx.todayMeetings[0]) overview += ` — next: ${ctx.todayMeetings[0].title} at ${ctx.todayMeetings[0].startTime}`;
    overview += "\n";
  }
  overview += `${ctx.totalContactsCount} contacts · ${ctx.totalAccountsCount} accounts · ${ctx.totalCompaniesCount} companies · ${ctx.totalLeadsCount} leads\n`;
  overview += `${ctx.recentActivitiesCount} atividades esta semana\n`;
  if (ctx.totalCommissionsPending > 0 || ctx.totalCommissionsEarned > 0)
    overview += `Commissions: Earned ${formatCurrency(ctx.totalCommissionsEarned)} | Pending ${formatCurrency(ctx.totalCommissionsPending)}\n`;
  if (ctx.propertyComps.length > 0) overview += `${ctx.propertyComps.length} comp(s) | ${ctx.dealDocuments.length} documento(s)\n`;
  overview += "\n";

  if (ctx.overdueTasksCount > 0 && ctx.atRiskDealsCount > 0) {
    overview += "**Priority #1:** Overdue tasks + at-risk deals. In CRE, each day of DD delay erodes confidence. Start with the highest-value deal.";
  } else if (ctx.overdueTasksCount > 0) {
    overview += `**Priority #1:** ${ctx.overdueTasksCount} overdue tasks. In CRE, timing is everything.`;
  } else if (ctx.atRiskDealsCount > 0) {
    overview += `**Priority #1:** ${ctx.atRiskDealsCount} at-risk deal(s). Aggressive follow-ups. No response 48h after LOI? Change approach.`;
  } else if (ctx.staleLeadsCount > 0) {
    overview += `**Healthy pipeline!** Re-engage the ${ctx.staleLeadsCount} cold leads with a market update or comp report.`;
  } else {
    overview += "**Tudo sob controle.** Momento ideal para prospectar. Foque em Industrial e NNN Retail — melhor deal velocity atualmente.";
  }

  const sug: Suggestion[] = [];
  if (ctx.overdueTasksCount > 0) sug.push({ label: "Overdue tasks", action: "Overdue tasks" });
  if (ctx.atRiskDealsCount > 0) sug.push({ label: "At-risk deals", action: "At-risk deals" });
  if (ctx.staleLeadsCount > 0) sug.push({ label: "Cold leads", action: "Cold leads" });
  if (sug.length === 0) { sug.push({ label: "Portfolio", action: "Portfolio overview" }); sug.push({ label: "Cap Rates", action: "Cap rate analysis" }); }
  sug.push({ label: "Market Intel", action: "CRE market trends" });
  return { message: overview, suggestions: sug.slice(0, 3) };
}

// ─── POST /api/ai/chat ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const rateKey = `ai-chat:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    let body: { message?: string };
    try { body = await request.json(); } catch { return sendError(badRequest("Invalid JSON body")); }

    const message = body.message?.trim();
    if (!message) return sendError(badRequest("message is required"));
    if (message.length > 2000) return sendError(badRequest("Message too long (max 2000 characters)"));

    const userId = (session.user as any).id;
    const organizationId = (session.user as any).organizationId;

    if (!organizationId) {
      return sendSuccess<ChatResponse>({
        message: "Your account is not yet linked to an organization. Complete onboarding first so I can access your CRM data.",
      });
    }

    const ctx = await loadCRMContext(organizationId, userId);

    // Try to get market intelligence if the message mentions market/news/trends
    let marketIntel = "";
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("market") ||
        lowerMsg.includes("news") || lowerMsg.includes("trend") ||
        lowerMsg.includes("forecast") || lowerMsg.includes("projection")) {
      marketIntel = await searchWeb(`commercial real estate market ${new Date().getFullYear()} trends`);
    }

    // ── Try AI provider first ─────────────────────────────────────────
    if (openaiTaskProvider.isConfigured()) {
      try {
        const systemPrompt = buildSystemPrompt(ctx, marketIntel);
        const result = await openaiTaskProvider.generateText(message, {
          maxTokens: 800,
          temperature: 0.7,
          systemInstruction: systemPrompt,
        });
        const suggestions = generateSuggestionsForMessage(message, ctx);
        return sendSuccess<ChatResponse>({ message: result.text, suggestions });
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

// ─── Suggestion Generator ──────────────────────────────────────────────────

function generateSuggestionsForMessage(message: string, ctx: CRMContext): Suggestion[] {
  const lower = message.toLowerCase();
  const suggestions: Suggestion[] = [];

  if (lower.includes("lead") || lower.includes("stale") || lower.includes("cold")) {
    suggestions.push({ label: "Pipeline", action: "How is my pipeline?" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Re-engajamento", action: "Plano de re-engajamento para leads" });
  }
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity") || lower.includes("opportunities")) {
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "At-risk deals", action: "At-risk deals" });
    suggestions.push({ label: "Forecast", action: "Revenue forecast" });
  }
  if (lower.includes("task") || lower.includes("overdue") || lower.includes("overdue")) {
    suggestions.push({ label: "Pipeline impact", action: "Which deals are impacted by overdue tasks?" });
  }
  if (lower.includes("meeting") || lower.includes("agenda")) {
    suggestions.push({ label: "Tasks do dia", action: "Pending tasks" });
  }
  if (lower.includes("account") || lower.includes("contact") || lower.includes("company") || lower.includes("organization")) {
    suggestions.push({ label: "Pipeline", action: "Pipeline" });
    suggestions.push({ label: "Leads", action: "My leads" });
  }
  if (lower.includes("forecast") || lower.includes("receita") || lower.includes("projection")) {
    suggestions.push({ label: "At-risk deals", action: "At-risk deals" });
    suggestions.push({ label: "Commissions", action: "My commissions" });
  }
  // CRE-specific
  if (lower.includes("cap rate") || lower.includes("caprate") || lower.includes("capitalization")) {
    suggestions.push({ label: "Comps", action: "My comparables" });
    suggestions.push({ label: "Market", action: "Market trends" });
  }
  if (lower.includes("commission")) {
    suggestions.push({ label: "Forecast", action: "Revenue forecast" });
    suggestions.push({ label: "Pipeline", action: "Pipeline" });
  }
  if (lower.includes("comp") || lower.includes("comparable")) {
    suggestions.push({ label: "Cap Rates", action: "Cap rate analysis" });
    suggestions.push({ label: "Portfolio", action: "Portfolio overview" });
  }
  if (lower.includes("due diligence") || lower.includes(" dd ")) {
    suggestions.push({ label: "Documents", action: "Document status" });
    suggestions.push({ label: "Tasks", action: "Pending tasks" });
  }
  if (lower.includes("document") || lower.includes("loi") || lower.includes("psa")) {
    suggestions.push({ label: "DD Status", action: "Due diligence status" });
    suggestions.push({ label: "Pipeline", action: "Pipeline" });
  }
  if (lower.includes("portfolio") || lower.includes("overview")) {
    suggestions.push({ label: "Market Intel", action: "CRE market trends" });
    suggestions.push({ label: "Commissions", action: "My commissions" });
  }
  if (lower.includes("market") || lower.includes("trend")) {
    suggestions.push({ label: "Cap Rates", action: "Cap rate analysis" });
    suggestions.push({ label: "Portfolio", action: "Portfolio overview" });
  }

  if (suggestions.length === 0) {
    if (ctx.overdueTasksCount > 0) suggestions.push({ label: "Overdue tasks", action: "Overdue tasks" });
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "At-risk deals", action: "At-risk deals" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Cold leads", action: "Cold leads" });
    if (suggestions.length === 0) suggestions.push({ label: "CRE Portfolio", action: "Portfolio overview" });
  }

  return suggestions.slice(0, 3);
}
