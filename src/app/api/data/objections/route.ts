import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { inferPersona } from "@/lib/scoring/engine";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const objections = await prisma.insight.findMany({
      where: {
        organizationId: session.user.organizationId,
        category: "RECURRING_OBJECTION"
      },
      include: {
        opportunity: {
          include: {
            primaryContact: true,
            owner: true
          }
        }
      }
    });

    // Aggregations
    const byTitle: Record<string, { count: number, lossCount: number }> = {};
    const byStage: Record<string, number> = {};
    const byPersona: Record<string, number> = {};
    const byRep: Record<string, number> = {};

    let totalObjections = objections.length;
    let lethalObjections = 0; // Led to CLOSED_LOST

    for (const obj of objections) {
      const title = obj.title;
      const isLethal = obj.opportunity?.stage === "CLOSED_LOST";
      
      const stage = obj.opportunity?.stage || "UNKNOWN";
      
      // Determine persona organically
      const persona = inferPersona(obj.opportunity?.primaryContact?.title);
      
      const rep = obj.opportunity?.ownerName || obj.opportunity?.owner?.name || "Unassigned";

      // By Title
      if (!byTitle[title]) byTitle[title] = { count: 0, lossCount: 0 };
      byTitle[title].count++;
      if (isLethal) {
        byTitle[title].lossCount++;
        lethalObjections++;
      }

      // Context Aggregation
      byStage[stage] = (byStage[stage] || 0) + 1;
      byPersona[persona] = (byPersona[persona] || 0) + 1;
      byRep[rep] = (byRep[rep] || 0) + 1;
    }

    // Format for frontend lists
    const topObjections = Object.entries(byTitle)
      .map(([title, data]) => ({
        title,
        count: data.count,
        lossRate: Math.round((data.lossCount / data.count) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    return sendSuccess({
      overview: {
        total: totalObjections,
        globalLossRate: totalObjections > 0 ? Math.round((lethalObjections / totalObjections) * 100) : 0
      },
      topObjections,
      distribution: {
        byStage: Object.entries(byStage).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        byPersona: Object.entries(byPersona).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        byRep: Object.entries(byRep).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
      }
    });
  } catch (error: any) {
    console.error("GET /api/data/objections error:", error);
    return sendUnhandledError();
  }
}
