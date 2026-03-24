import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const accounts = await prisma.account.findMany({
      where: {
        organizationId: session.user.organizationId,
        isCustomer: true
      },
      include: {
        company: {
          include: { contacts: true }
        },
        opportunities: {
          include: { owner: true }
        }
      }
    });

    let totalDeliveryDays = 0;
    let deliveryCount = 0;
    
    let totalActivationDays = 0;
    let activationCount = 0;

    let onboardingCompletedCount = 0;
    
    let totalDelayDays = 0;
    let delayCount = 0;

    const churnReasons: Record<string, number> = {};
    const churnSegments: Record<string, number> = {};
    const churnPersonas: Record<string, number> = {};
    const churnReps: Record<string, number> = {};
    const churnSources: Record<string, number> = {};

    let totalChurned = 0;

    for (const acc of accounts) {
      // 1. Post-sale timing
      if (acc.becameCustomerAt) {
        const becameMs = new Date(acc.becameCustomerAt).getTime();
        
        if (acc.deliveryDate) {
          const deliveryDays = (new Date(acc.deliveryDate).getTime() - becameMs) / (1000 * 60 * 60 * 24);
          totalDeliveryDays += deliveryDays >= 0 ? deliveryDays : 0;
          deliveryCount++;
        }
        
        if (acc.activationDate) {
          const activationDays = (new Date(acc.activationDate).getTime() - becameMs) / (1000 * 60 * 60 * 24);
          totalActivationDays += activationDays >= 0 ? activationDays : 0;
          activationCount++;
        }
      }

      if (acc.onboardingStatus === "COMPLETED") {
        onboardingCompletedCount++;
      }

      if (acc.implementationDelayDays != null && acc.implementationDelayDays > 0) {
        totalDelayDays += acc.implementationDelayDays;
        delayCount++;
      }

      // 2. Churn Intelligence
      if (acc.churnDate) {
        totalChurned++;
        
        // Reason
        const reason = acc.churnReason || "Unknown Reason";
        churnReasons[reason] = (churnReasons[reason] || 0) + 1;

        // Segment (Company size/industry)
        let segment = "Unsegmented";
        if (acc.company?.industry && acc.company?.size) {
           segment = `${acc.company.industry} (${acc.company.size})`;
        } else if (acc.company?.industry) {
           segment = acc.company.industry;
        } else if (acc.company?.size) {
           segment = acc.company.size;
        }
        churnSegments[segment] = (churnSegments[segment] || 0) + 1;

        // Persona (Champion/Decision Maker title)
        let personaVal = "Unknown Persona";
        if (acc.company?.contacts && acc.company.contacts.length > 0) {
           const dm = acc.company.contacts.find(c => c.isDecisionMaker || c.isChampion) || acc.company.contacts[0];
           if (dm.title) personaVal = dm.title;
        }
        churnPersonas[personaVal] = (churnPersonas[personaVal] || 0) + 1;

        // Rep
        let repName = "Unassigned";
        const wonOpp = acc.opportunities.find(o => o.stage === "CLOSED_WON" || o.stage === "closed-won" || o.stageId);
        if (wonOpp && wonOpp.ownerName) {
           repName = wonOpp.ownerName;
        } else if (wonOpp && wonOpp.owner?.name) {
           repName = wonOpp.owner.name;
        } else if (acc.ownerId) {
           repName = acc.ownerId; // Suboptimal but fallback since we don't have user object directly here
        }
        churnReps[repName] = (churnReps[repName] || 0) + 1;

        // Source
        const source = wonOpp?.sourceSystem || "Organic/Web";
        churnSources[source] = (churnSources[source] || 0) + 1;
      }
    }

    const formatMetrics = (record: Record<string, number>) => {
      return Object.entries(record).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    };

    const avgDeliveryDays = deliveryCount ? Math.round(totalDeliveryDays / deliveryCount) : 0;
    const avgActivationDays = activationCount ? Math.round(totalActivationDays / activationCount) : 0;
    const onboardingCompletionRate = accounts.length ? Math.round((onboardingCompletedCount / accounts.length) * 100) : 0;
    const avgDelayDays = delayCount ? Math.round(totalDelayDays / delayCount) : 0;

    return sendSuccess({
      postSale: {
        avgDeliveryDays,
        avgActivationDays,
        onboardingCompletionRate,
        avgDelayDays,
      },
      churn: {
        totalChurned,
        byReason: formatMetrics(churnReasons),
        bySegment: formatMetrics(churnSegments),
        byPersona: formatMetrics(churnPersonas),
        byRep: formatMetrics(churnReps),
        bySource: formatMetrics(churnSources),
      }
    });

  } catch (error: any) {
    console.error("GET /api/data/post-sale error:", error);
    return sendUnhandledError();
  }
}
