/**
 * Business Metrics Engine
 *
 * Centralized computation of volume, conversion, profitability,
 * and temporal metrics. Consumed by Data module, Reports, and Dashboards.
 *
 * All metrics are grounded in Prisma queries against real data.
 * Assumptions are documented inline.
 */

import { prisma } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VolumeMetrics {
  prospects: number;       // Leads with status NEW
  mql: number;             // Leads with fitScore >= 60 (Marketing Qualified)
  sal: number;             // Leads with status CONTACTED (Sales Accepted)
  sql: number;             // Leads with status QUALIFIED (Sales Qualified)
  noShow: number;          // Leads with status UNQUALIFIED
  proposals: number;       // Opportunities in PROPOSAL stage
  closings: number;        // Opportunities in CLOSED_WON
  totalLeads: number;
  totalOpportunities: number;
}

export interface ConversionMetrics {
  prospectToSal: number;   // NEW → CONTACTED rate
  salToSql: number;        // CONTACTED → QUALIFIED rate
  mqlToSql: number;        // MQL (fitScore≥60) → QUALIFIED rate
  lto: number;             // Lead-to-Opportunity (CONVERTED / total leads)
  otc: number;             // Opportunity-to-Close (CLOSED_WON / total opps)
  globalConversion: number; // End-to-end: CLOSED_WON opps / total leads
  churnRate: number;       // Churned accounts / total customer accounts
  stageConversions: StageConversion[];
}

export interface StageConversion {
  from: string;
  to: string;
  rate: number;
  count: number;
  total: number;
}

export interface ProfitabilityMetrics {
  /** Average Contract Value — mean value of CLOSED_WON deals */
  acv: number;
  /** Annual Recurring Revenue — sum of customer account values (assumption: ACV = ARR for SaaS) */
  arr: number;
  /** Monthly Recurring Revenue — ARR / 12 */
  mrr: number;
  /** Mean Ticket — average opportunity value across all stages */
  meanTicket: number;
  totalWonRevenue: number;
  totalPipeline: number;
  dealCount: number;
}

export interface TemporalMetrics {
  /** Average Length of Sales Cycle — days from opportunity creation to CLOSED_WON */
  avgSalesCycleDays: number;
  /** Average Contract Length — inferred from account becameCustomerAt to churnDate or now */
  avgContractLengthDays: number;
  /** Time to Generate Lead — days from lead creation to first activity */
  ttgl: number;
  /** Time to Value — days from account becameCustomerAt to activationDate */
  ttv: number;
  /** Average days per intermediate stage */
  stageVelocity: StageVelocity[];
}

export interface StageVelocity {
  stage: string;
  avgDays: number;
  dealCount: number;
}

export interface RepPerformance {
  id: string;
  name: string;
  role: string;
  // Volume
  leadsOwned: number;
  leadsConverted: number;
  dealsOwned: number;
  dealsWon: number;
  dealsLost: number;
  // Conversion
  leadConversionRate: number;
  winRate: number;
  // Revenue
  revenue: number;
  pipeline: number;
  avgDealSize: number;
  // Activity
  totalActivities: number;
  calls: number;
  emails: number;
  meetings: number;
  // Temporal
  avgCycleDays: number;
  // Quality
  overdueTasks: number;
  stalledDeals: number;
}

export interface AllMetrics {
  volume: VolumeMetrics;
  conversion: ConversionMetrics;
  profitability: ProfitabilityMetrics;
  temporal: TemporalMetrics;
  repPerformance: RepPerformance[];
  computedAt: string;
  assumptions: string[];
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export async function computeAllMetrics(
  organizationId: string,
  periodDays?: number
): Promise<AllMetrics> {
  const dateFilter = periodDays
    ? { gte: new Date(Date.now() - periodDays * 86400000) }
    : undefined;

  const [volume, conversion, profitability, temporal, repPerformance] = await Promise.all([
    computeVolume(organizationId, dateFilter),
    computeConversion(organizationId, dateFilter),
    computeProfitability(organizationId, dateFilter),
    computeTemporal(organizationId),
    computeRepPerformance(organizationId, dateFilter),
  ]);

  return {
    volume,
    conversion,
    profitability,
    temporal,
    repPerformance,
    computedAt: new Date().toISOString(),
    assumptions: [
      "MQL defined as leads with fitScore >= 60",
      "SAL defined as leads with status CONTACTED",
      "SQL defined as leads with status QUALIFIED",
      "ACV = mean value of CLOSED_WON opportunities",
      "ARR = sum of all CLOSED_WON values (assumption: annual contracts)",
      "MRR = ARR / 12",
      "TTGL = avg days from lead creation to first activity",
      "TTV = avg days from becameCustomerAt to activationDate",
      "Sales cycle = days from opportunity createdAt to CLOSED_WON updatedAt",
      "Contract length = days from becameCustomerAt to churnDate or now",
      "Churn rate = churned accounts / total customer accounts",
    ],
  };
}

async function computeVolume(
  organizationId: string,
  dateFilter?: { gte: Date }
): Promise<VolumeMetrics> {
  const where: any = { organizationId };
  if (dateFilter) where.createdAt = dateFilter;

  const [leads, opps] = await Promise.all([
    prisma.lead.findMany({ where, select: { status: true, fitScore: true } }),
    prisma.opportunity.findMany({
      where: { organizationId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { stage: true },
    }),
  ]);

  return {
    prospects: leads.filter(l => l.status === "NEW").length,
    mql: leads.filter(l => (l.fitScore ?? 0) >= 60).length,
    sal: leads.filter(l => l.status === "CONTACTED").length,
    sql: leads.filter(l => l.status === "QUALIFIED").length,
    noShow: leads.filter(l => l.status === "UNQUALIFIED").length,
    proposals: opps.filter(o => o.stage?.toUpperCase() === "PROPOSAL").length,
    closings: opps.filter(o => o.stage?.toUpperCase() === "CLOSED_WON").length,
    totalLeads: leads.length,
    totalOpportunities: opps.length,
  };
}

async function computeConversion(
  organizationId: string,
  dateFilter?: { gte: Date }
): Promise<ConversionMetrics> {
  const where: any = { organizationId };
  if (dateFilter) where.createdAt = dateFilter;

  const [leads, opps, accounts] = await Promise.all([
    prisma.lead.findMany({ where, select: { status: true, fitScore: true } }),
    prisma.opportunity.findMany({
      where: { organizationId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { stage: true },
    }),
    prisma.account.findMany({
      where: { organizationId },
      select: { isCustomer: true, churnDate: true },
    }),
  ]);

  const total = leads.length || 1;
  const newLeads = leads.filter(l => l.status === "NEW").length;
  const contacted = leads.filter(l => l.status === "CONTACTED").length;
  const qualified = leads.filter(l => l.status === "QUALIFIED").length;
  const converted = leads.filter(l => l.status === "CONVERTED").length;
  const mql = leads.filter(l => (l.fitScore ?? 0) >= 60).length;

  const totalOpps = opps.length || 1;
  const won = opps.filter(o => o.stage?.toUpperCase() === "CLOSED_WON").length;
  const lost = opps.filter(o => o.stage?.toUpperCase() === "CLOSED_LOST").length;

  const customers = accounts.filter(a => a.isCustomer);
  const churned = customers.filter(a => a.churnDate != null);

  // Stage flow conversion rates
  const stages = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"];
  const stageCounts: Record<string, number> = {};
  for (const s of stages) {
    stageCounts[s] = opps.filter(o => o.stage?.toUpperCase() === s || (s === "CLOSED_WON" && o.stage?.toUpperCase() === "CLOSED_WON")).length;
  }

  const stageConversions: StageConversion[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const fromCount = stageCounts[stages[i]] + stageCounts[stages[i + 1]]; // survived + advanced
    const toCount = stageCounts[stages[i + 1]];
    stageConversions.push({
      from: stages[i],
      to: stages[i + 1],
      rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
      count: toCount,
      total: fromCount,
    });
  }

  return {
    prospectToSal: Math.round(((contacted + qualified + converted) / total) * 100),
    salToSql: contacted > 0 ? Math.round(((qualified + converted) / (contacted + qualified + converted)) * 100) : 0,
    mqlToSql: mql > 0 ? Math.round((qualified / mql) * 100) : 0,
    lto: Math.round((converted / total) * 100),
    otc: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    globalConversion: Math.round((won / total) * 100),
    churnRate: customers.length > 0 ? Math.round((churned.length / customers.length) * 100) : 0,
    stageConversions,
  };
}

async function computeProfitability(
  organizationId: string,
  dateFilter?: { gte: Date }
): Promise<ProfitabilityMetrics> {
  const opps = await prisma.opportunity.findMany({
    where: { organizationId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
    select: { stage: true, value: true },
  });

  const wonDeals = opps.filter(o => o.stage?.toUpperCase() === "CLOSED_WON");
  const activeDeals = opps.filter(o => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage?.toUpperCase() ?? ""));

  const totalWon = wonDeals.reduce((s, o) => s + (o.value ?? 0), 0);
  const totalPipeline = activeDeals.reduce((s, o) => s + (o.value ?? 0), 0);
  const totalAll = opps.reduce((s, o) => s + (o.value ?? 0), 0);

  const acv = wonDeals.length > 0 ? Math.round(totalWon / wonDeals.length) : 0;
  const arr = totalWon; // Assumption: each won deal = 1 year contract
  const mrr = Math.round(arr / 12);
  const meanTicket = opps.length > 0 ? Math.round(totalAll / opps.length) : 0;

  return {
    acv,
    arr,
    mrr,
    meanTicket,
    totalWonRevenue: totalWon,
    totalPipeline,
    dealCount: opps.length,
  };
}

async function computeTemporal(organizationId: string): Promise<TemporalMetrics> {
  // Sales cycle: CLOSED_WON opportunities, days from creation to update
  const wonOpps = await prisma.opportunity.findMany({
    where: { organizationId, stage: "CLOSED_WON" },
    select: { createdAt: true, updatedAt: true },
  });

  const cycleDays = wonOpps.map(o => {
    const diff = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
    return Math.max(1, Math.round(diff / 86400000));
  });
  const avgSalesCycleDays = cycleDays.length > 0
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : 0;

  // Contract length: becameCustomerAt to churnDate or now
  const customers = await prisma.account.findMany({
    where: { organizationId, isCustomer: true },
    select: { becameCustomerAt: true, churnDate: true },
  });

  const contractDays = customers
    .filter(c => c.becameCustomerAt)
    .map(c => {
      const end = c.churnDate ? new Date(c.churnDate) : new Date();
      const diff = end.getTime() - new Date(c.becameCustomerAt!).getTime();
      return Math.max(1, Math.round(diff / 86400000));
    });
  const avgContractLengthDays = contractDays.length > 0
    ? Math.round(contractDays.reduce((a, b) => a + b, 0) / contractDays.length)
    : 0;

  // TTGL: Time to Generate Lead — avg days from lead creation to first activity
  const leads = await prisma.lead.findMany({
    where: { organizationId },
    select: { id: true, createdAt: true },
  });
  const leadIds = leads.map(l => l.id);

  let ttgl = 0;
  if (leadIds.length > 0) {
    const firstActivities = await prisma.activity.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: "asc" },
      select: { leadId: true, createdAt: true },
    });

    const firstByLead = new Map<string, Date>();
    for (const a of firstActivities) {
      if (a.leadId && !firstByLead.has(a.leadId)) {
        firstByLead.set(a.leadId, a.createdAt);
      }
    }

    const ttglDays = leads
      .filter(l => firstByLead.has(l.id))
      .map(l => {
        const diff = firstByLead.get(l.id)!.getTime() - new Date(l.createdAt).getTime();
        return Math.max(0, Math.round(diff / 86400000));
      });

    ttgl = ttglDays.length > 0
      ? Math.round(ttglDays.reduce((a, b) => a + b, 0) / ttglDays.length)
      : 0;
  }

  // TTV: Time to Value — avg days from becameCustomerAt to activationDate
  const ttvAccounts = customers.filter(c => c.becameCustomerAt);
  const activatedAccounts = await prisma.account.findMany({
    where: { organizationId, isCustomer: true, activationDate: { not: null } },
    select: { becameCustomerAt: true, activationDate: true },
  });

  const ttvDays = activatedAccounts
    .filter(a => a.becameCustomerAt && a.activationDate)
    .map(a => {
      const diff = new Date(a.activationDate!).getTime() - new Date(a.becameCustomerAt!).getTime();
      return Math.max(0, Math.round(diff / 86400000));
    });
  const ttv = ttvDays.length > 0
    ? Math.round(ttvDays.reduce((a, b) => a + b, 0) / ttvDays.length)
    : 0;

  // Stage velocity: average days per stage
  const allOpps = await prisma.opportunity.findMany({
    where: { organizationId },
    select: { stage: true, createdAt: true, updatedAt: true },
  });

  const stageGroups = new Map<string, number[]>();
  for (const o of allOpps) {
    const stage = (o.stage ?? "").toUpperCase();
    const days = Math.max(1, Math.round(
      (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
    ));
    if (!stageGroups.has(stage)) stageGroups.set(stage, []);
    stageGroups.get(stage)!.push(days);
  }

  const stageVelocity: StageVelocity[] = [];
  for (const [stage, days] of stageGroups.entries()) {
    if (["CLOSED_WON", "CLOSED_LOST"].includes(stage)) continue;
    stageVelocity.push({
      stage,
      avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      dealCount: days.length,
    });
  }

  return { avgSalesCycleDays, avgContractLengthDays, ttgl, ttv, stageVelocity };
}

async function computeRepPerformance(
  organizationId: string,
  dateFilter?: { gte: Date }
): Promise<RepPerformance[]> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, role: true },
  });

  const results: RepPerformance[] = [];

  for (const user of users) {
    const [leads, opps, activities, tasks] = await Promise.all([
      prisma.lead.findMany({
        where: { ownerId: user.id, organizationId },
        select: { status: true },
      }),
      prisma.opportunity.findMany({
        where: { ownerId: user.id, organizationId },
        select: { stage: true, value: true, createdAt: true, updatedAt: true },
      }),
      prisma.activity.findMany({
        where: { creatorId: user.id, organizationId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        select: { type: true },
      }),
      prisma.task.findMany({
        where: { ownerId: user.id, organizationId },
        select: { status: true, dueDate: true },
      }),
    ]);

    const converted = leads.filter(l => l.status === "CONVERTED").length;
    const won = opps.filter(o => o.stage?.toUpperCase() === "CLOSED_WON");
    const lost = opps.filter(o => o.stage?.toUpperCase() === "CLOSED_LOST");
    const active = opps.filter(o => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage?.toUpperCase() ?? ""));
    const revenue = won.reduce((s, o) => s + (o.value ?? 0), 0);
    const pipeline = active.reduce((s, o) => s + (o.value ?? 0), 0);

    const wonCycles = won.map(o => Math.max(1, Math.round(
      (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
    )));

    const stalledDeals = active.filter(o => {
      const days = Math.round((Date.now() - new Date(o.updatedAt).getTime()) / 86400000);
      return days > 14;
    }).length;

    results.push({
      id: user.id,
      name: user.name,
      role: user.role,
      leadsOwned: leads.length,
      leadsConverted: converted,
      dealsOwned: opps.length,
      dealsWon: won.length,
      dealsLost: lost.length,
      leadConversionRate: leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0,
      winRate: (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
      revenue,
      pipeline,
      avgDealSize: won.length > 0 ? Math.round(revenue / won.length) : 0,
      totalActivities: activities.length,
      calls: activities.filter(a => a.type === "CALL").length,
      emails: activities.filter(a => a.type === "EMAIL" || a.type === "EMAIL_RECEIVED" || a.type === "EMAIL_SENT").length,
      meetings: activities.filter(a => a.type === "MEETING").length,
      avgCycleDays: wonCycles.length > 0 ? Math.round(wonCycles.reduce((a, b) => a + b, 0) / wonCycles.length) : 0,
      overdueTasks: tasks.filter(t => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < new Date()).length,
      stalledDeals,
    });
  }

  return results.sort((a, b) => b.revenue - a.revenue);
}
