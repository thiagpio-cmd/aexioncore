import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "CLOSER");
    if (roleError) return roleError;

    const orgId = session.user.organizationId;

    // Get forecast snapshots
    const forecasts = await prisma.forecastSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    // Compute live forecast from opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: { organizationId: orgId },
      select: {
        stage: true,
        value: true,
        probability: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true } },
      },
    });

    const active = opportunities.filter(o => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage));
    const won = opportunities.filter(o => o.stage === "CLOSED_WON");
    const lost = opportunities.filter(o => o.stage === "CLOSED_LOST");

    const totalPipeline = active.reduce((s, o) => s + o.value, 0);
    const weightedPipeline = active.reduce((s, o) => s + o.value * (o.probability / 100), 0);
    const commit = active.filter(o => o.probability >= 70).reduce((s, o) => s + o.value, 0);
    const bestCase = active.filter(o => o.probability >= 40).reduce((s, o) => s + o.value, 0);
    const wonRevenue = won.reduce((s, o) => s + o.value, 0);
    const lostRevenue = lost.reduce((s, o) => s + o.value, 0);
    const winRate = (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    // Scenarios
    const scenarios = {
      conservative: Math.round(commit * 0.85),
      moderate: Math.round(weightedPipeline),
      optimistic: Math.round(bestCase * 1.1),
    };

    // Gap analysis vs latest target
    const latestForecast = forecasts[0];
    const target = latestForecast?.target || 0;
    const gap = target - wonRevenue - commit;
    const coverageRatio = commit > 0 ? Math.round((totalPipeline / commit) * 10) / 10 : 0;

    // Per-rep forecast
    const repMap = new Map<string, { name: string; commit: number; bestCase: number; pipeline: number; won: number }>();
    for (const opp of opportunities) {
      if (!opp.owner) continue;
      const key = opp.owner.id;
      if (!repMap.has(key)) {
        repMap.set(key, { name: opp.owner.name, commit: 0, bestCase: 0, pipeline: 0, won: 0 });
      }
      const rep = repMap.get(key)!;
      if (opp.stage === "CLOSED_WON") {
        rep.won += opp.value;
      } else if (!["CLOSED_LOST"].includes(opp.stage)) {
        rep.pipeline += opp.value;
        if (opp.probability >= 70) rep.commit += opp.value;
        if (opp.probability >= 40) rep.bestCase += opp.value;
      }
    }

    // At-risk deals (high value, stale)
    const atRiskDeals = active.filter(o => {
      const days = Math.floor((Date.now() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      return days > 14 && o.value > 50000;
    });

    return sendSuccess({
      snapshots: forecasts,
      live: {
        totalPipeline,
        weightedPipeline: Math.round(weightedPipeline),
        commit,
        bestCase,
        wonRevenue,
        lostRevenue,
        winRate,
        activeDeals: active.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        coverageRatio,
        scenarios,
        gap: Math.max(0, gap),
        target,
        atRiskCount: atRiskDeals.length,
        atRiskValue: atRiskDeals.reduce((s, o) => s + o.value, 0),
        byRep: Array.from(repMap.values()).sort((a, b) => b.pipeline - a.pipeline),
      },
    });
  } catch (error: any) {
    console.error("GET /api/forecast error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const body = await request.json();
    const { quarter, year, commit, bestCase, pipeline, target } = body;

    if (!quarter || !year) return sendError(badRequest("quarter and year are required"));

    const forecast = await prisma.forecastSnapshot.create({
      data: {
        organizationId: session.user.organizationId,
        quarter,
        year: Number(year),
        commit: Number(commit) || 0,
        bestCase: Number(bestCase) || 0,
        pipeline: Number(pipeline) || 0,
        target: Number(target) || 0,
      },
    });

    return sendSuccess(forecast, 201);
  } catch (error: any) {
    console.error("POST /api/forecast error:", error);
    return sendUnhandledError();
  }
}
