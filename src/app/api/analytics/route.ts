import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const orgId = session.user.organizationId;
    const now = new Date();

    // Period filter
    const periodParam = request.nextUrl.searchParams.get("period") || "30d";
    const periodDays: Record<string, number | null> = {
      "7d": 7, "30d": 30, "90d": 90, "365d": 365, all: null,
    };
    const days = periodDays[periodParam] ?? 30;
    const dateFilter = days
      ? { gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) }
      : undefined;

    const [opportunities, leads, activities, tasks, accounts] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: orgId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: {
          owner: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.activity.findMany({
        where: { organizationId: orgId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      prisma.task.findMany({
        where: { organizationId: orgId },
        include: { owner: { select: { id: true, name: true } } },
      }),
      prisma.account.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, status: true },
      }),
    ]);

    // --- Revenue metrics ---
    const wonOpps = opportunities.filter((o) => o.stage === "CLOSED_WON");
    const lostOpps = opportunities.filter((o) => o.stage === "CLOSED_LOST");
    const activeOpps = opportunities.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
    const totalRevenue = wonOpps.reduce((s, o) => s + o.value, 0);
    const totalPipeline = activeOpps.reduce((s, o) => s + o.value, 0);
    const totalLost = lostOpps.reduce((s, o) => s + o.value, 0);
    const closedCount = wonOpps.length + lostOpps.length;
    const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
    const avgDealSize = wonOpps.length > 0 ? Math.round(totalRevenue / wonOpps.length) : 0;

    // --- Monthly revenue trend (last 6 months) ---
    const monthlyRevenue: { month: string; won: number; lost: number; created: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const monthWon = wonOpps
        .filter((o) => new Date(o.updatedAt) >= d && new Date(o.updatedAt) <= monthEnd)
        .reduce((s, o) => s + o.value, 0);
      const monthLost = lostOpps
        .filter((o) => new Date(o.updatedAt) >= d && new Date(o.updatedAt) <= monthEnd)
        .reduce((s, o) => s + o.value, 0);
      const monthCreated = opportunities
        .filter((o) => new Date(o.createdAt) >= d && new Date(o.createdAt) <= monthEnd).length;

      monthlyRevenue.push({ month: monthLabel, won: monthWon, lost: monthLost, created: monthCreated });
    }

    // --- Lead funnel ---
    const leadsByStatus = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"].map((status) => ({
      status,
      count: leads.filter((l) => l.status === status).length,
    }));

    const leadsBySource = ["INBOUND", "OUTBOUND", "REFERRAL", "EVENT", "WEBSITE", "OTHER"].map((source) => {
      const sourceLeads = leads.filter((l) => (l.source || "OTHER").toUpperCase() === source);
      const converted = sourceLeads.filter((l) => l.status === "CONVERTED").length;
      return {
        source,
        count: sourceLeads.length,
        converted,
        conversionRate: sourceLeads.length > 0 ? Math.round((converted / sourceLeads.length) * 100) : 0,
      };
    }).filter((s) => s.count > 0);

    const leadsByTemperature = ["HOT", "WARM", "COLD"].map((temp) => ({
      temperature: temp,
      count: leads.filter((l) => l.temperature === temp).length,
    }));

    // --- Pipeline by stage ---
    const pipelineByStage = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"].map((stage) => {
      const stageOpps = activeOpps.filter((o) => o.stage === stage);
      return {
        stage,
        count: stageOpps.length,
        value: stageOpps.reduce((s, o) => s + o.value, 0),
        avgProbability: stageOpps.length > 0
          ? Math.round(stageOpps.reduce((s, o) => s + o.probability, 0) / stageOpps.length)
          : 0,
      };
    });

    // --- Rep performance ---
    const repPerformance = [...new Set(opportunities.map((o) => o.ownerId))].map((ownerId) => {
      const repOpps = opportunities.filter((o) => o.ownerId === ownerId);
      const repWon = repOpps.filter((o) => o.stage === "CLOSED_WON");
      const repLost = repOpps.filter((o) => o.stage === "CLOSED_LOST");
      const repActive = repOpps.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
      const repLeads = leads.filter((l) => l.ownerId === ownerId);
      const repClosed = repWon.length + repLost.length;
      return {
        name: repOpps[0]?.owner?.name || "Unknown",
        deals: repOpps.length,
        won: repWon.length,
        lost: repLost.length,
        active: repActive.length,
        revenue: repWon.reduce((s, o) => s + o.value, 0),
        pipeline: repActive.reduce((s, o) => s + o.value, 0),
        winRate: repClosed > 0 ? Math.round((repWon.length / repClosed) * 100) : 0,
        leads: repLeads.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // --- Activity breakdown ---
    const activityByType = ["CALL", "EMAIL", "MEETING", "NOTE", "WHATSAPP"].map((type) => ({
      type,
      count: activities.filter((a) => a.type === type).length,
    })).filter((a) => a.count > 0);

    // --- Task metrics ---
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const overdueTasks = tasks.filter((t) => t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate) < now).length;
    const pendingTasks = tasks.filter((t) => t.status !== "COMPLETED").length;

    // --- Forecast ---
    const forecastCommit = activeOpps
      .filter((o) => o.probability >= 70)
      .reduce((s, o) => s + o.value, 0);
    const forecastBestCase = activeOpps
      .filter((o) => o.probability >= 40)
      .reduce((s, o) => s + o.value, 0);
    const forecastWeighted = activeOpps
      .reduce((s, o) => s + (o.value * o.probability / 100), 0);

    return sendSuccess({
      summary: {
        totalRevenue,
        totalPipeline,
        totalLost,
        winRate,
        avgDealSize,
        totalLeads: leads.length,
        totalAccounts: accounts.length,
        totalDeals: opportunities.length,
        completedTasks,
        overdueTasks,
        pendingTasks,
        totalActivities: activities.length,
      },
      forecast: {
        commit: forecastCommit,
        bestCase: forecastBestCase,
        weighted: Math.round(forecastWeighted),
      },
      monthlyRevenue,
      leadsByStatus,
      leadsBySource,
      leadsByTemperature,
      pipelineByStage,
      repPerformance,
      activityByType,
    });
  } catch (error: any) {
    console.error("GET /api/analytics error:", error);
    return sendUnhandledError();
  }
}
