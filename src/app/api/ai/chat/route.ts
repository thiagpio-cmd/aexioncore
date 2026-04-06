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

  return `Você é a **Aexion AI** — a Diretora Comercial digital da Aexion Core. Você atua como uma CCO (Chief Commercial Officer) de alto nível para investimentos em real estate comercial nos EUA.

QUEM VOCÊ É:
- Você é a conselheira estratégica pessoal do Thiago Pio, CEO da Aexion Core
- Tem 20+ anos de experiência em commercial real estate, M&A e gestão de pipeline
- Pensa como uma diretora comercial que precisa bater metas trimestrais
- É direta, estratégica, e sempre orienta a próxima ação concreta
- SEMPRE responde em português brasileiro, mesmo que o usuário escreva em inglês
- Usa termos do mercado imobiliário americano em inglês quando relevante (closing, LOI, due diligence, etc.)

SEU ESTILO DE COMUNICAÇÃO:
- Tom executivo e direto — sem enrolação, sem frases genéricas
- Sempre começa com o insight mais importante (a "manchete")
- Usa **negrito** para nomes, valores e métricas-chave
- Termina SEMPRE com uma recomendação acionável ou pergunta estratégica
- Máximo 4-6 frases por resposta, a menos que o usuário peça detalhes
- Quando lista itens, usa bullets organizados por prioridade/urgência
- Nunca diz "não tenho dados" — se não tem info completa, analisa o que tem e sugere ações

SUA INTELIGÊNCIA ESTRATÉGICA:
- Analisa sinais de risco: deals parados, leads esfriando, tasks acumulando
- Cruza dados: se um deal grande tem tasks atrasadas, alerta sobre o impacto
- Prioriza por valor financeiro e urgência, não por ordem alfabética
- Identifica padrões: qual stage tem mais deals travados? Qual lead source converte melhor?
- Sugere timing: "Este deal está no stage X há Y dias — hora de escalar"
- Pensa em relacionamento: quem é o champion? Quem é o decision maker?
- Orienta negociação: quando pressionar, quando recuar, quando enviar LOI revisado

═══ PIPELINE (${ctx.activeDealsCount} deals ativos, ${formatCurrency(ctx.pipelineTotal)} total) ═══
${topDeals || "Nenhum deal ativo."}

═══ DEALS EM RISCO (probabilidade < 40%): ${ctx.atRiskDealsCount} ═══
${atRiskDeals || "Nenhum — pipeline saudável."}

═══ LEADS (${ctx.totalLeadsCount} total | ${leadStatusLine}) ═══
${leadsList || "Nenhum lead ativo."}
Stale (30+ dias sem atividade): ${ctx.staleLeadsCount}

═══ TASKS (${ctx.totalTasksCount} abertas) ═══
Atrasadas (${ctx.overdueTasksCount}):
${overdueTasksList || "Nenhuma atrasada."}
Próximos 7 dias:
${upcomingTasksList || "Nenhuma agendada."}

═══ REUNIÕES ═══
Hoje (${ctx.todayMeetingsCount}):
${todayMeetingsList || "Nenhuma reunião hoje."}
Próximos 7 dias:
${upcomingMeetingsList || "Nenhuma agendada."}

═══ ACCOUNTS (${ctx.totalAccountsCount} total) ═══
${accountsList || "Nenhum account."}

═══ CONTATOS (${ctx.totalContactsCount} total) ═══
${contactsList || "Nenhum contato."}

═══ EMPRESAS (${ctx.totalCompaniesCount} total) ═══
${companiesList || "Nenhuma empresa."}

═══ ATIVIDADE RECENTE (últimos 7 dias: ${ctx.recentActivitiesCount}) ═══
${recentActivityList || "Nenhuma atividade recente."}

REGRAS ABSOLUTAS:
1. SEMPRE responda em português brasileiro
2. Use NOMES ESPECÍFICOS, valores e dados reais — NUNCA invente dados ou use placeholders
3. Formate valores em dólar americano: $18.5M, $250K
4. Cruze dados entre entidades: task + deal, lead + empresa, contato + account
5. Priorize por impacto financeiro e urgência
6. Seja proativa: se vê um problema nos dados, mencione mesmo que o usuário não tenha perguntado
7. Cada resposta deve ter uma AÇÃO CONCRETA no final
8. Trate o Thiago como CEO — ele precisa de visão estratégica, não de relatórios operacionais`;
}

function generateRuleBasedResponse(message: string, ctx: CRMContext): ChatResponse {
  const lower = message.toLowerCase();
  const fmtStage = (s: string) => s.replace(/_/g, " ").toLowerCase();

  // ── Ajuda / Capabilities ────────────────────────────────────────────
  if (lower.includes("help") || lower.includes("what can you") || lower.includes("ajuda") || lower.includes("o que você") || lower.includes("capabilit")) {
    return {
      message:
        "Thiago, eu tenho acesso a **todos os dados do seu CRM** e atuo como sua diretora comercial. Posso te ajudar com:\n\n" +
        "• **Pipeline & Deals** — análise de saúde, deals em risco, breakdown por stage\n" +
        "• **Leads** — leads esfriando, priorização de follow-up, qualificação\n" +
        "• **Tasks** — atrasadas, próximas da semana, plano de ação diário\n" +
        "• **Reuniões** — agenda do dia, prep para calls, próximas da semana\n" +
        "• **Accounts & Contatos** — champions, decision makers, saúde das contas\n" +
        "• **Empresas** — portfólio, indústria, relacionamentos\n" +
        "• **Forecast** — projeção ponderada, breakdown por stage, cenários\n" +
        "• **Atividades** — volume de engajamento, tendências\n\n" +
        "Me pergunte qualquer coisa — eu analiso e recomendo a próxima ação.",
      suggestions: [
        { label: "Briefing do dia", action: "Me dê o briefing do dia" },
        { label: "Pipeline", action: "Como está meu pipeline?" },
        { label: "Deals em risco", action: "Quais deals estão em risco?" },
      ],
    };
  }

  // ── Leads ────────────────────────────────────────────────────────────
  if (lower.includes("lead") || lower.includes("leads") || lower.includes("stale") || lower.includes("esfriando") || lower.includes("prospecção")) {
    if (ctx.staleLeadsCount === 0 && ctx.allLeads.length === 0) {
      return {
        message: "Nenhum lead ativo no momento. Hora de prospectar — quer que eu analise o pipeline para identificar oportunidades de geração de leads?",
        suggestions: [{ label: "Pipeline", action: "Analise meu pipeline" }, { label: "Empresas", action: "Quais empresas tenho?" }],
      };
    }

    // Show all leads with strategic analysis
    const hotLeads = ctx.allLeads.filter((l) => l.temperature === "HOT" || l.fitScore >= 70);
    const coldLeads = ctx.staleLeads;

    let msg = `**Visão estratégica de leads** — ${ctx.totalLeadsCount} total no CRM:\n\n`;

    if (hotLeads.length > 0) {
      const hotList = hotLeads.slice(0, 3)
        .map((l) => `  • **${l.name}** (${l.company}) — fit ${l.fitScore}/100, ${l.temperature.toLowerCase()}, ${fmtStage(l.status)}`)
        .join("\n");
      msg += `🔥 **Leads quentes (${hotLeads.length}):**\n${hotList}\n\n`;
    }

    if (coldLeads.length > 0) {
      const coldList = coldLeads.slice(0, 3)
        .map((l) => `  • **${l.name}** (${l.company}) — ${l.daysSinceUpdate} dias sem contato`)
        .join("\n");
      msg += `🧊 **Leads esfriando (${coldLeads.length}):**\n${coldList}\n\n`;
    }

    const statusLine = Object.entries(ctx.leadsByStatus)
      .map(([s, c]) => `${fmtStage(s)}: ${c}`)
      .join(" · ");
    msg += `📊 **Status:** ${statusLine}\n\n`;

    if (coldLeads.length > 0) {
      msg += `**Minha recomendação:** Priorize o re-engajamento de **${coldLeads[0]?.name}** (${coldLeads[0]?.daysSinceUpdate} dias parado). Lead frio por mais de 45 dias tem taxa de conversão 3x menor. Quer que eu monte um plano de abordagem?`;
    } else if (hotLeads.length > 0) {
      msg += `**Minha recomendação:** Seus leads quentes estão prontos para avançar. **${hotLeads[0]?.name}** tem fit score de ${hotLeads[0]?.fitScore} — hora de agendar uma call de qualificação.`;
    } else {
      msg += "**Minha recomendação:** Seus leads precisam de mais nutrição. Considere uma campanha de re-engajamento por e-mail.";
    }

    return {
      message: msg,
      suggestions: [
        { label: "Plano de re-engajamento", action: "Monte um plano de re-engajamento para leads frios" },
        { label: "Pipeline", action: "Como está meu pipeline?" },
        { label: "Forecast", action: "Qual minha previsão de receita?" },
      ],
    };
  }

  // ── Deals em Risco ──────────────────────────────────────────────────
  if (lower.includes("risco") || lower.includes("risk") || lower.includes("at-risk") || lower.includes("perigo") || lower.includes("travad")) {
    if (ctx.atRiskDealsCount === 0) {
      return {
        message:
          `Boa notícia, Thiago — nenhum deal em risco no momento. Todos os ${ctx.activeDealsCount} deals ativos têm probabilidade ≥ 40%. ` +
          `Pipeline saudável em **${formatCurrency(ctx.pipelineTotal)}**. Momento ideal para acelerar os deals em stages avançados.`,
        suggestions: [
          { label: "Pipeline completo", action: "Mostra o pipeline completo" },
          { label: "Forecast", action: "Previsão de receita" },
        ],
      };
    }

    const dealList = ctx.atRiskDeals
      .sort((a, b) => b.value - a.value)
      .map((d) => `  • **${d.title}** — ${formatCurrency(d.value)} | ${d.probability}% prob | ${fmtStage(d.stage)} | ${d.daysInStage}d no stage`)
      .join("\n");

    const totalAtRiskValue = ctx.atRiskDeals.reduce((s, d) => s + d.value, 0);
    const stuckDeals = ctx.atRiskDeals.filter((d) => d.daysInStage > 14);
    const biggestAtRisk = ctx.atRiskDeals.sort((a, b) => b.value - a.value)[0];

    let msg =
      `**${ctx.atRiskDealsCount} deals em risco** — ${formatCurrency(totalAtRiskValue)} em jogo:\n\n` +
      dealList + "\n\n";

    msg += `**Análise estratégica:**\n`;
    if (stuckDeals.length > 0) {
      msg += `• ${stuckDeals.length} deal${stuckDeals.length > 1 ? "s" : ""} travado${stuckDeals.length > 1 ? "s" : ""} há mais de 2 semanas — sinal de objeção não resolvida ou falta de champion interno\n`;
    }
    if (biggestAtRisk) {
      msg += `• **${biggestAtRisk.title}** é o maior em risco (${formatCurrency(biggestAtRisk.value)}) — sugiro escalar com call executiva esta semana\n`;
    }
    msg += `\n**Ação imediata:** Agende follow-ups para os deals travados. Se o prospect não responder em 48h, mude a abordagem — entre por outro contato na empresa.`;

    return {
      message: msg,
      suggestions: [
        { label: "Priorizar deals", action: "Me ajude a priorizar os deals em risco" },
        { label: "Pipeline completo", action: "Pipeline completo" },
        { label: "Impacto no forecast", action: "Qual o impacto dos deals em risco no forecast?" },
      ],
    };
  }

  // ── Pipeline / Deals / Oportunidades ────────────────────────────────
  if (
    lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity") ||
    lower.includes("oportunidade") || lower.includes("negócio") || lower.includes("negocio")
  ) {
    const dealBreakdown = ctx.topOpportunities
      .map((d) => `  • **${d.title}** — ${formatCurrency(d.value)} | ${fmtStage(d.stage)} | ${d.probability}% | ${d.daysInStage}d`)
      .join("\n");

    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
    }
    const stageStr = Object.entries(stageBreakdown)
      .map(([s, d]) => `${s}: ${d.count} (${formatCurrency(d.value)})`)
      .join(" · ");

    let msg =
      `**Pipeline: ${formatCurrency(ctx.pipelineTotal)}** — ${ctx.activeDealsCount} deals ativos\n\n` +
      `**Top deals por valor:**\n${dealBreakdown || "Nenhum deal ativo."}\n\n` +
      `**Por stage:** ${stageStr}\n\n`;

    if (ctx.atRiskDealsCount > 0) {
      const atRiskNames = ctx.atRiskDeals.slice(0, 3).map((d) => `**${d.title}**`).join(", ");
      msg += `⚠ **Atenção:** ${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount > 1 ? "s" : ""} em risco: ${atRiskNames}. Probabilidade < 40% — precisam de ação imediata.`;
    } else {
      msg += "✅ Pipeline saudável — todas as probabilidades acima de 40%. Quer ver a projeção de receita?";
    }

    return {
      message: msg,
      suggestions: [
        ...(ctx.atRiskDealsCount > 0 ? [{ label: "Deals em risco", action: "Analise os deals em risco" }] : []),
        { label: "Forecast", action: "Previsão de receita" },
        { label: "Tasks pendentes", action: "Quais tasks estão pendentes?" },
      ],
    };
  }

  // ── Tasks / Tarefas ─────────────────────────────────────────────────
  if (lower.includes("task") || lower.includes("tarefa") || lower.includes("overdue") || lower.includes("atrasad") || lower.includes("pendente") || lower.includes("to-do") || lower.includes("todo")) {
    if (ctx.overdueTasksCount === 0 && ctx.upcomingTasks.length === 0) {
      return {
        message: `Tudo em dia, Thiago — nenhuma task atrasada ou pendente. ${ctx.totalTasksCount > 0 ? `${ctx.totalTasksCount} tasks abertas no total. ` : ""}Hora de focar em prospecção ou avançar deals.`,
        suggestions: [{ label: "Pipeline", action: "Como está meu pipeline?" }, { label: "Leads", action: "Meus leads" }],
      };
    }

    let msg = "";
    if (ctx.overdueTasksCount > 0) {
      const taskList = ctx.overdueTasks
        .sort((a, b) => {
          const prio: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (prio[b.priority] || 0) - (prio[a.priority] || 0);
        })
        .slice(0, 5)
        .map((t) => `  • **${t.title}** [${t.priority}] — ${t.daysOverdue}d atrasada${t.relatedTo ? ` → ${t.relatedTo}` : ""}`)
        .join("\n");
      msg += `🚨 **${ctx.overdueTasksCount} task${ctx.overdueTasksCount > 1 ? "s" : ""} atrasada${ctx.overdueTasksCount > 1 ? "s" : ""}:**\n${taskList}\n\n`;
    }
    if (ctx.upcomingTasks.length > 0) {
      const upcoming = ctx.upcomingTasks.slice(0, 3)
        .map((t) => `  • **${t.title}** [${t.priority}] — vence ${t.dueDate}${t.relatedTo ? ` → ${t.relatedTo}` : ""}`)
        .join("\n");
      msg += `📋 **Próximas da semana:**\n${upcoming}\n\n`;
    }

    // Strategic insight — link tasks to deals
    const dealLinkedOverdue = ctx.overdueTasks.filter((t) => t.relatedTo);
    if (dealLinkedOverdue.length > 0) {
      msg += `**Impacto no pipeline:** ${dealLinkedOverdue.length} task${dealLinkedOverdue.length > 1 ? "s" : ""} atrasada${dealLinkedOverdue.length > 1 ? "s" : ""} ${dealLinkedOverdue.length > 1 ? "estão" : "está"} vinculada${dealLinkedOverdue.length > 1 ? "s" : ""} a deals — cada dia de atraso reduz momentum de negociação. Comece pelas de prioridade HIGH/CRITICAL.`;
    } else {
      msg += "**Recomendação:** Resolva as tasks atrasadas antes de avançar com novos deals. Momentum perdido é difícil de recuperar.";
    }

    return {
      message: msg,
      suggestions: [
        { label: "Briefing do dia", action: "O que devo focar hoje?" },
        { label: "Pipeline", action: "Pipeline" },
        ...(ctx.staleLeadsCount > 0 ? [{ label: "Leads frios", action: "Leads esfriando" }] : []),
      ],
    };
  }

  // ── Reuniões / Agenda ───────────────────────────────────────────────
  if (lower.includes("meeting") || lower.includes("reunião") || lower.includes("reuniao") || lower.includes("agenda") || lower.includes("calendar") || lower.includes("schedule")) {
    let msg = "";
    if (ctx.todayMeetings.length > 0) {
      const todayList = ctx.todayMeetings
        .map((m) => `  • **${m.startTime}** — ${m.title}${m.relatedTo ? ` (${m.relatedTo})` : ""} | ${m.attendees}`)
        .join("\n");
      msg += `📅 **Reuniões de hoje (${ctx.todayMeetingsCount}):**\n${todayList}\n\n`;
    } else {
      msg += "📅 Nenhuma reunião agendada para hoje.\n\n";
    }
    if (ctx.upcomingMeetings.length > 0) {
      const upList = ctx.upcomingMeetings.slice(0, 5)
        .map((m) => `  • ${m.title}${m.relatedTo ? ` → ${m.relatedTo}` : ""}`)
        .join("\n");
      msg += `**Próximas da semana:**\n${upList}\n\n`;
    }

    if (ctx.todayMeetings.length > 0) {
      msg += `**Prep:** Primeira reunião às ${ctx.todayMeetings[0].startTime}. Revise os dados do deal antes da call — uma boa preparação aumenta em 40% a chance de avanço de stage.`;
    } else {
      msg += "**Oportunidade:** Agenda livre hoje — aproveite para fazer follow-ups com prospects e avançar deals parados. Quer que eu identifique os mais urgentes?";
    }

    return {
      message: msg,
      suggestions: [
        { label: "Deals em risco", action: "Deals em risco" },
        { label: "Tasks do dia", action: "Tasks pendentes" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Accounts / Contas ───────────────────────────────────────────────
  if (lower.includes("account") || lower.includes("conta") || lower.includes("customer") || lower.includes("cliente") || lower.includes("onboarding")) {
    const customers = ctx.accounts.filter((a) => a.isCustomer);
    const accountList = ctx.accounts.slice(0, 8)
      .map((a) => `  • **${a.name}** (${a.company}) — ${a.status}${a.isCustomer ? " ✅ cliente" : ""}${a.onboardingStatus !== "PENDING" ? ` | onboarding: ${fmtStage(a.onboardingStatus)}` : ""}`)
      .join("\n");

    return {
      message:
        `**${ctx.totalAccountsCount} accounts** (${customers.length} cliente${customers.length !== 1 ? "s" : ""} ativo${customers.length !== 1 ? "s" : ""}):\n\n` +
        (accountList || "Nenhum account.") +
        (ctx.totalAccountsCount > 8 ? `\n  ...e mais ${ctx.totalAccountsCount - 8}.\n\n` : "\n\n") +
        `**Visão CCO:** Acompanhe de perto os accounts em onboarding — a experiência nos primeiros 90 dias define a retenção de longo prazo.`,
      suggestions: [
        { label: "Contatos-chave", action: "Quem são meus contatos-chave?" },
        { label: "Empresas", action: "Minhas empresas" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Contatos ────────────────────────────────────────────────────────
  if (lower.includes("contact") || lower.includes("contato") || lower.includes("champion") || lower.includes("decision maker") || lower.includes("decisor")) {
    const champions = ctx.contacts.filter((c) => c.isChampion);
    const decisionMakers = ctx.contacts.filter((c) => c.isDecisionMaker);
    const contactList = ctx.contacts.slice(0, 8)
      .map((c) => `  • **${c.name}** (${c.company})${c.title ? ` — ${c.title}` : ""}${c.isChampion ? " ⭐ champion" : ""}${c.isDecisionMaker ? " 🎯 decisor" : ""}`)
      .join("\n");

    let msg =
      `**${ctx.totalContactsCount} contatos** (${champions.length} champion${champions.length !== 1 ? "s" : ""}, ${decisionMakers.length} decisor${decisionMakers.length !== 1 ? "es" : ""}):\n\n` +
      (contactList || "Nenhum contato.") +
      (ctx.totalContactsCount > 8 ? `\n  ...e mais ${ctx.totalContactsCount - 8}.\n\n` : "\n\n");

    if (champions.length > 0) {
      msg += `**Estratégia:** Seus champions são o ativo mais valioso. **${champions[0].name}** é quem defende seu deal internamente — mantenha esse relacionamento aquecido com check-ins regulares.`;
    } else {
      msg += "**Alerta estratégico:** Nenhum champion identificado. Sem um defensor interno, deals avançam 60% mais devagar. Identifique quem mais se beneficia do seu produto em cada account.";
    }

    return {
      message: msg,
      suggestions: [
        { label: "Accounts", action: "Meus accounts" },
        { label: "Empresas", action: "Empresas" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Empresas ────────────────────────────────────────────────────────
  if (lower.includes("company") || lower.includes("companies") || lower.includes("empresa") || lower.includes("organizaç")) {
    const companyList = ctx.companies.slice(0, 8)
      .map((c) => `  • **${c.name}**${c.industry ? ` (${c.industry})` : ""} — ${c.contactsCount} contatos, ${c.leadsCount} leads, ${c.accountsCount} accounts`)
      .join("\n");

    const companiesWithoutLeads = ctx.companies.filter((c) => c.leadsCount === 0 && c.accountsCount === 0);

    let msg =
      `**${ctx.totalCompaniesCount} empresa${ctx.totalCompaniesCount !== 1 ? "s" : ""}** no CRM:\n\n` +
      (companyList || "Nenhuma empresa.") +
      (ctx.totalCompaniesCount > 8 ? `\n  ...e mais ${ctx.totalCompaniesCount - 8}.\n\n` : "\n\n");

    if (companiesWithoutLeads.length > 0) {
      msg += `**Oportunidade:** ${companiesWithoutLeads.length} empresa${companiesWithoutLeads.length > 1 ? "s" : ""} sem leads ou accounts ativos — potencial inexplorado. Quer que eu identifique quais valem a pena reativar?`;
    } else {
      msg += "Todas as empresas têm leads ou accounts vinculados. Quer análise de alguma específica?";
    }

    return {
      message: msg,
      suggestions: [
        { label: "Contatos", action: "Meus contatos" },
        { label: "Accounts", action: "Accounts" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Atividades ──────────────────────────────────────────────────────
  if (lower.includes("activit") || lower.includes("atividade") || lower.includes("histórico") || lower.includes("history") || lower.includes("engajamento")) {
    const activityList = ctx.recentActivities.slice(0, 5)
      .map((a) => `  • [${a.createdAt}] **${a.type}**${a.subject ? `: ${a.subject}` : ""}${a.channel ? ` (${a.channel})` : ""}`)
      .join("\n");

    const isLowActivity = ctx.recentActivitiesCount < 10;

    return {
      message:
        `**${ctx.recentActivitiesCount} atividades** nos últimos 7 dias:\n\n` +
        (activityList || "Nenhuma atividade recente.") +
        (ctx.recentActivitiesCount > 5 ? `\n  ...e mais ${ctx.recentActivitiesCount - 5}.\n\n` : "\n\n") +
        (isLowActivity
          ? "**Alerta CCO:** Volume de atividade baixo. Regra de ouro: cada deal ativo precisa de pelo menos 2 touchpoints por semana para manter momentum. Aumente o ritmo de outreach."
          : "**Bom ritmo!** Mantenha essa cadência. Consistência de atividade é o melhor preditor de conversão."),
      suggestions: [
        { label: "Leads frios", action: "Leads esfriando" },
        { label: "Tasks", action: "Tasks pendentes" },
        { label: "Pipeline", action: "Pipeline" },
      ],
    };
  }

  // ── Forecast / Receita / Projeção ───────────────────────────────────
  if (lower.includes("forecast") || lower.includes("revenue") || lower.includes("previsão") || lower.includes("receita") || lower.includes("projeção") || lower.includes("projection")) {
    const weightedPipeline = ctx.topOpportunities.reduce(
      (sum, o) => sum + o.value * (o.probability / 100), 0
    );

    const stageBreakdown: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const o of ctx.topOpportunities) {
      const stage = fmtStage(o.stage);
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0, weighted: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += o.value;
      stageBreakdown[stage].weighted += o.value * (o.probability / 100);
    }
    const breakdownStr = Object.entries(stageBreakdown)
      .map(([s, d]) => `  • **${s}:** ${d.count} deal${d.count > 1 ? "s" : ""} — ${formatCurrency(d.value)} (ponderado: ${formatCurrency(d.weighted)})`)
      .join("\n");

    const conversionRate = ctx.pipelineTotal > 0 ? ((weightedPipeline / ctx.pipelineTotal) * 100).toFixed(0) : "0";

    return {
      message:
        `**Forecast ponderado: ${formatCurrency(weightedPipeline)}**\n` +
        `Pipeline total: ${formatCurrency(ctx.pipelineTotal)} | ${ctx.activeDealsCount} deals | Taxa de conversão implícita: ${conversionRate}%\n\n` +
        `**Por stage:**\n${breakdownStr || "Sem dados."}\n\n` +
        (ctx.atRiskDealsCount > 0
          ? `**Risco:** ${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount > 1 ? "s" : ""} com probabilidade < 40% ${ctx.atRiskDealsCount > 1 ? "estão" : "está"} puxando o forecast pra baixo. Melhorar esses deals pode adicionar **${formatCurrency(ctx.atRiskDeals.reduce((s, d) => s + d.value * 0.3, 0))}** ao forecast.`
          : "**Pipeline saudável** — probabilidades consistentes em todas as stages. Foco em acelerar os deals em stages avançados para fechar este trimestre."),
      suggestions: [
        { label: "Deals em risco", action: "Deals em risco" },
        { label: "Top deals", action: "Meus maiores deals" },
        { label: "Leads", action: "Meus leads" },
      ],
    };
  }

  // ── Default: Briefing Executivo ─────────────────────────────────────
  let overview = "**Briefing executivo, Thiago:**\n\n";

  overview += `💰 **Pipeline:** ${formatCurrency(ctx.pipelineTotal)} em ${ctx.activeDealsCount} deals`;
  if (ctx.atRiskDealsCount > 0) overview += ` (⚠ ${ctx.atRiskDealsCount} em risco)`;
  overview += "\n";

  if (ctx.overdueTasksCount > 0) {
    const topOverdue = ctx.overdueTasks[0];
    overview += `🚨 **${ctx.overdueTasksCount} task${ctx.overdueTasksCount > 1 ? "s" : ""} atrasada${ctx.overdueTasksCount > 1 ? "s" : ""}**`;
    if (topOverdue) overview += ` — urgente: ${topOverdue.title} (${topOverdue.daysOverdue}d)`;
    overview += "\n";
  }

  if (ctx.staleLeadsCount > 0) {
    overview += `🧊 **${ctx.staleLeadsCount} lead${ctx.staleLeadsCount > 1 ? "s" : ""} esfriando** — precisam de re-engajamento\n`;
  }

  if (ctx.todayMeetingsCount > 0) {
    overview += `📅 **${ctx.todayMeetingsCount} reunião${ctx.todayMeetingsCount > 1 ? "ões" : ""} hoje**`;
    if (ctx.todayMeetings[0]) overview += ` — próxima: ${ctx.todayMeetings[0].title} às ${ctx.todayMeetings[0].startTime}`;
    overview += "\n";
  }

  overview += `👥 ${ctx.totalContactsCount} contatos · ${ctx.totalAccountsCount} accounts · ${ctx.totalCompaniesCount} empresas · ${ctx.totalLeadsCount} leads\n`;
  overview += `📈 ${ctx.recentActivitiesCount} atividades esta semana\n\n`;

  // Strategic recommendation
  if (ctx.overdueTasksCount > 0 && ctx.atRiskDealsCount > 0) {
    overview += `**Prioridade #1:** Resolva as tasks atrasadas vinculadas aos deals em risco — cada dia de atraso corrói a confiança do prospect. Comece pelo deal de maior valor.`;
  } else if (ctx.overdueTasksCount > 0) {
    overview += `**Prioridade #1:** ${ctx.overdueTasksCount} tasks atrasadas. Tasks pendentes travam o avanço dos deals. Resolva as de prioridade HIGH primeiro.`;
  } else if (ctx.atRiskDealsCount > 0) {
    overview += `**Prioridade #1:** ${ctx.atRiskDealsCount} deal${ctx.atRiskDealsCount > 1 ? "s" : ""} em risco. Agende follow-ups agressivos esta semana — se não houver resposta em 48h, mude a abordagem.`;
  } else if (ctx.staleLeadsCount > 0) {
    overview += `**Pipeline saudável!** Foco agora: re-engajar os ${ctx.staleLeadsCount} leads frios antes que virem oportunidades perdidas.`;
  } else {
    overview += "**Tudo sob controle.** Pipeline saudável, tasks em dia, leads aquecidos. Momento ideal para prospectar novos deals e expandir o pipeline.";
  }

  const defaultSuggestions: Suggestion[] = [];
  if (ctx.overdueTasksCount > 0) defaultSuggestions.push({ label: "Tasks atrasadas", action: "Tasks atrasadas" });
  if (ctx.atRiskDealsCount > 0) defaultSuggestions.push({ label: "Deals em risco", action: "Deals em risco" });
  if (ctx.staleLeadsCount > 0) defaultSuggestions.push({ label: "Leads frios", action: "Leads esfriando" });
  if (defaultSuggestions.length === 0) {
    defaultSuggestions.push({ label: "Pipeline", action: "Pipeline" });
    defaultSuggestions.push({ label: "Forecast", action: "Previsão de receita" });
  }
  defaultSuggestions.push({ label: "O que posso fazer?", action: "O que você pode fazer?" });

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
          "Thiago, sua conta ainda não está vinculada a uma organização. " +
          "Complete o onboarding primeiro para que eu possa acessar seus dados de CRM.",
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

  if (lower.includes("lead") || lower.includes("stale") || lower.includes("esfriando")) {
    suggestions.push({ label: "Pipeline", action: "Como está meu pipeline?" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Re-engajamento", action: "Plano de re-engajamento para leads" });
  }
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity") || lower.includes("negócio")) {
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "Deals em risco", action: "Deals em risco" });
    suggestions.push({ label: "Forecast", action: "Previsão de receita" });
  }
  if (lower.includes("task") || lower.includes("tarefa") || lower.includes("overdue") || lower.includes("atrasad")) {
    suggestions.push({ label: "Impacto no pipeline", action: "Quais deals são impactados pelas tasks atrasadas?" });
  }
  if (lower.includes("meeting") || lower.includes("reunião") || lower.includes("agenda")) {
    suggestions.push({ label: "Tasks do dia", action: "Tasks pendentes" });
  }
  if (lower.includes("account") || lower.includes("contact") || lower.includes("company") || lower.includes("contato") || lower.includes("empresa")) {
    suggestions.push({ label: "Pipeline", action: "Pipeline" });
    suggestions.push({ label: "Leads", action: "Meus leads" });
  }
  if (lower.includes("forecast") || lower.includes("receita") || lower.includes("previsão")) {
    suggestions.push({ label: "Deals em risco", action: "Deals em risco" });
    suggestions.push({ label: "Top deals", action: "Meus maiores deals" });
  }

  // Always offer follow-ups
  if (suggestions.length === 0) {
    if (ctx.overdueTasksCount > 0) suggestions.push({ label: "Tasks atrasadas", action: "Tasks atrasadas" });
    if (ctx.atRiskDealsCount > 0) suggestions.push({ label: "Deals em risco", action: "Deals em risco" });
    if (ctx.staleLeadsCount > 0) suggestions.push({ label: "Leads frios", action: "Leads esfriando" });
    if (suggestions.length === 0) suggestions.push({ label: "Briefing", action: "Me dê o briefing do dia" });
  }

  return suggestions.slice(0, 3);
}
