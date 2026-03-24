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

    const opportunities = await prisma.opportunity.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        tasks: {
          where: { status: "PENDING" }
        },
        owner: { select: { id: true, name: true } }
      }
    });

    const now = Date.now();
    const STALLED_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

    // We'll use our constants equivalent
    const stages = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];

    const stageAnalysis = stages.map(stageName => {
      const dealsInStage = opportunities.filter(o => o.stage === stageName);
      const count = dealsInStage.length;
      
      let totalValue = 0;
      let totalAgingMs = 0;
      let stalledCount = 0;
      let noNextStepCount = 0;
      const ownerCounts: Record<string, number> = {};

      for (const deal of dealsInStage) {
        totalValue += deal.value;
        totalAgingMs += (now - new Date(deal.createdAt).getTime());
        
        if ((now - new Date(deal.updatedAt).getTime()) > STALLED_MS) {
          stalledCount++;
        }
        
        if (deal.tasks.length === 0) {
          noNextStepCount++;
        }

        const ownerName = deal.ownerName || deal.owner?.name || "Unassigned";
        ownerCounts[ownerName] = (ownerCounts[ownerName] || 0) + 1;
      }

      // Find top owner
      const topOwner = Object.keys(ownerCounts).length > 0 
        ? Object.entries(ownerCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
        : "None";

      return {
        stage: stageName,
        count,
        totalValue,
        avgAgingDays: count > 0 ? Math.floor((totalAgingMs / count) / (1000 * 60 * 60 * 24)) : 0,
        stalledRate: count > 0 ? Math.round((stalledCount / count) * 100) : 0,
        noNextStepRate: count > 0 ? Math.round((noNextStepCount / count) * 100) : 0,
        topOwner
      };
    });

    // We separate active vs closed to build the "advance rate" / pipeline matrix
    const activePipeline = stageAnalysis.filter(s => !s.stage.includes("CLOSED"));

    return sendSuccess({
      stageAnalysis: activePipeline,
      closedAnalysis: stageAnalysis.filter(s => s.stage.includes("CLOSED")),
      globalStalledCount: activePipeline.reduce((acc, stage) => acc + Math.round((stage.stalledRate/100) * stage.count), 0),
      globalNoNextStepCount: activePipeline.reduce((acc, stage) => acc + Math.round((stage.noNextStepRate/100) * stage.count), 0),
    });
  } catch (error: any) {
    console.error("GET /api/data/conversion error:", error);
    return sendUnhandledError();
  }
}
