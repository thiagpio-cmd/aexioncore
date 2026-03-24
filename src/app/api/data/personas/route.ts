import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { calculateLeadFit } from "@/lib/scoring/engine";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    // Fetch all active pipeline leads for the organization to generate a heuristic snapshot
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { notIn: ["CONVERTED", "DISQUALIFIED"] }
      },
      include: {
        company: true
      }
    });

    const metrics = {
      totalAnalyzed: leads.length,
      averageFit: 0,
      personaBreakdown: {
        "Decision Maker": 0,
        "Champion": 0,
        "Evaluator": 0,
        "Gatekeeper": 0,
        "Unknown": 0
      },
      highFitCount: 0, // > 70
      riskCount: 0 // < 40
    };

    if (leads.length === 0) {
      return sendSuccess(metrics);
    }

    let totalScore = 0;

    for (const lead of leads) {
      const scoring = calculateLeadFit(lead);
      totalScore += scoring.score;
      metrics.personaBreakdown[scoring.persona]++;

      if (scoring.score >= 70) metrics.highFitCount++;
      if (scoring.score < 40) metrics.riskCount++;
    }

    metrics.averageFit = Math.round(totalScore / leads.length);

    return sendSuccess(metrics);
  } catch (error: any) {
    console.error("GET /api/data/personas error:", error);
    return sendUnhandledError();
  }
}
