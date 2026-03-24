import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Fetch top recommendations that haven't been resolved
    const recs = await prisma.recommendation.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    const leadIds = recs.map(r => r.leadId).filter(Boolean) as string[];
    const oppIds = recs.map(r => r.opportunityId).filter(Boolean) as string[];

    const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } });
    const opps = await prisma.opportunity.findMany({ where: { id: { in: oppIds } }, select: { id: true, title: true } });

    const leadsMap = Object.fromEntries(leads.map(l => [l.id, l]));
    const oppsMap = Object.fromEntries(opps.map(o => [o.id, o]));

    const recommendations = recs.map(r => ({
      ...r,
      lead: r.leadId ? leadsMap[r.leadId] : undefined,
      opportunity: r.opportunityId ? oppsMap[r.opportunityId] : undefined,
    }));

    return sendSuccess({ recommendations });

  } catch (error: any) {
    console.error("GET /api/automation/recommendations error:", error);
    return sendUnhandledError();
  }
}
