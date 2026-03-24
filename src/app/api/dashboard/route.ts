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
    const userId = session.user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      opportunities,
      leads,
      tasks,
      activities,
      meetings,
      users,
    ] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: orgId },
        include: {
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId },
        include: {
          owner: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        where: { organizationId: orgId },
        include: { owner: { select: { id: true, name: true } } },
      }),
      prisma.activity.findMany({
        where: { organizationId: orgId },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.meeting.findMany({
        where: { organizationId: orgId },
        orderBy: { startTime: "asc" },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    // --- Shared aggregates ---
    const activeOpps = opportunities.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
    const wonOpps = opportunities.filter((o) => o.stage === "CLOSED_WON");
    const lostOpps = opportunities.filter((o) => o.stage === "CLOSED_LOST");
    const totalPipeline = activeOpps.reduce((s, o) => s + o.value, 0);
    const wonValue = wonOpps.reduce((s, o) => s + o.value, 0);
    const closedCount = wonOpps.length + lostOpps.length;
    const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;

    // --- SDR metrics ---
    const hotLeads = leads.filter((l) => l.temperature === "HOT");
    const todayLeads = leads.filter((l) => new Date(l.createdAt) >= todayStart);
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return t.status !== "COMPLETED" && new Date(t.dueDate) < now;
    });
    const pendingTasks = tasks.filter((t) => t.status !== "COMPLETED");
    const convertedLeads = leads.filter((l) => l.status === "CONVERTED");
    const conversionRate = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;

    // Priority leads (hot leads or recently contacted needing follow-up)
    const priorityLeads = leads
      .filter((l) => l.temperature === "HOT" || l.status === "CONTACTED" || l.status === "QUALIFIED")
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        name: l.name,
        company: l.company?.name || "Unknown",
        status: l.status,
        temperature: l.temperature,
        owner: l.owner?.name || "Unassigned",
      }));

    // --- Closer metrics ---
    const proposalOpps = activeOpps.filter((o) => o.stage === "PROPOSAL");
    const closingThisMonth = activeOpps.filter((o) => {
      if (!o.expectedCloseDate) return false;
      return new Date(o.expectedCloseDate) <= monthEnd;
    });
    const closingValue = closingThisMonth.reduce((s, o) => s + o.value, 0);
    const atRiskOpps = activeOpps.filter((o) => o.probability < 40);

    // Deals needing attention (low probability or stale)
    const dealsNeedingAttention = activeOpps
      .filter((o) => o.probability < 60)
      .sort((a, b) => a.probability - b.probability)
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        title: o.title,
        account: o.account?.name || "Unknown",
        value: o.value,
        probability: o.probability,
        stage: o.stage,
      }));

    // Upcoming meetings
    const upcomingMeetings = meetings
      .filter((m) => new Date(m.startTime) >= now)
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime,
        type: m.location || "Meeting",
      }));

    // --- Manager metrics ---
    const reps = users
      .filter((u) => ["SDR", "CLOSER", "USER"].includes(u.role))
      .map((u) => {
        const repActivities = activities.filter((a) => a.creatorId === u.id);
        const repTasks = tasks.filter((t) => t.ownerId === u.id);
        const repOverdue = repTasks.filter((t) => t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate) < now);
        const repLeads = leads.filter((l) => l.ownerId === u.id);
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          activities: repActivities.length,
          tasks: repTasks.length,
          overdueTasks: repOverdue.length,
          leads: repLeads.length,
        };
      });

    // Stage breakdown
    const stages = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"].map((stage) => {
      const stageOpps = activeOpps.filter((o) => o.stage === stage);
      return {
        stage,
        count: stageOpps.length,
        value: stageOpps.reduce((s, o) => s + o.value, 0),
      };
    });

    // --- Executive metrics ---
    const avgDealSize = activeOpps.length > 0 ? Math.round(totalPipeline / activeOpps.length) : 0;
    const forecastCommit = activeOpps
      .filter((o) => o.probability >= 70)
      .reduce((s, o) => s + o.value, 0);
    const bestCase = activeOpps
      .filter((o) => o.probability >= 40)
      .reduce((s, o) => s + o.value, 0);
    const coverageRatio = forecastCommit > 0 ? (totalPipeline / forecastCommit).toFixed(1) : "0";

    // Channel breakdown
    const channels = ["inbound", "outbound", "referral", "event"].map((source) => {
      const sourceLeads = leads.filter((l) => l.source?.toLowerCase() === source);
      const converted = sourceLeads.filter((l) => l.status === "CONVERTED").length;
      return {
        name: source.charAt(0).toUpperCase() + source.slice(1),
        leads: sourceLeads.length,
        conversion: sourceLeads.length > 0 ? Math.round((converted / sourceLeads.length) * 100) : 0,
      };
    });

    return sendSuccess({
      stats: {
        totalPipeline,
        wonValue,
        winRate,
        avgDealSize,
        hotLeads: hotLeads.length,
        todayLeads: todayLeads.length,
        overdueTasks: overdueTasks.length,
        pendingTasks: pendingTasks.length,
        conversionRate,
        activeDeals: activeOpps.length,
        atRiskDeals: atRiskOpps.length,
        proposalsSent: proposalOpps.length,
        closingThisMonth: closingThisMonth.length,
        closingValue,
        forecastCommit,
        bestCase,
        coverageRatio: parseFloat(coverageRatio as string),
        totalLeads: leads.length,
        totalActivities: activities.length,
      },
      stages,
      reps,
      channels,
      priorityLeads,
      dealsNeedingAttention,
      upcomingMeetings,
    });
  } catch (error: any) {
    console.error("GET /api/dashboard error:", error);
    return sendUnhandledError();
  }
}
