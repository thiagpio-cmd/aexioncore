import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { inferProfile, matchToICP } from "@/lib/intelligence/icp-engine";
import type { ProfileMatchResult } from "@/lib/intelligence/icp-engine";

type Ctx = { params: Promise<{ id: string }> };

interface ContactMatch {
  contactId: string;
  contactName: string;
  contactEmail: string;
  companyName: string | null;
  profileId: string | null;
  match: ProfileMatchResult;
}

/**
 * GET /api/icp/[id]/matches
 *
 * Encontra contatos que correspondem a um perfil ICP.
 * Infere perfis automaticamente para contatos sem perfil existente.
 *
 * Query params:
 *  - limit: max contacts to evaluate (default 50)
 *  - minScore: minimum match score to include (default 0)
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "view", { organizationId: actor.organizationId })) {
      return sendError(forbidden("Sem permissao para visualizar matches ICP"));
    }

    const { id: icpId } = await ctx.params;

    // Verify ICP exists and belongs to org
    const icp = await prisma.iCPProfile.findUnique({
      where: { id: icpId },
      select: { id: true, organizationId: true, name: true },
    });

    if (!icp) return sendError(notFound("Perfil ICP"));
    if (icp.organizationId !== actor.organizationId) {
      return sendError(forbidden("ICP pertence a outra organizacao"));
    }

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
    const minScore = Math.max(0, parseInt(url.searchParams.get("minScore") ?? "0", 10));

    // Get contacts from this org that have active opportunities
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: actor.organizationId,
        primaryOpportunities: {
          some: {
            organizationId: actor.organizationId,
            stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: { select: { name: true } },
      },
      take: limit,
    });

    const results: ContactMatch[] = [];

    for (const contact of contacts) {
      // Ensure a profile exists
      let profile = await prisma.customerProfile.findUnique({
        where: {
          contactId_organizationId: {
            contactId: contact.id,
            organizationId: actor.organizationId,
          },
        },
      });

      if (!profile) {
        // Infer and persist profile
        const inferred = await inferProfile(contact.id, actor.organizationId);
        profile = await prisma.customerProfile.create({
          data: {
            contactId: contact.id,
            organizationId: actor.organizationId,
            bigFive: inferred.bigFive as any,
            jungArchetype: inferred.jungArchetype,
            lifestyle: inferred.lifestyle as any,
            valueSensitivity: inferred.valueSensitivity as any,
            motivationProfile: inferred.motivationProfile as any,
            conditioningProfile: inferred.conditioningProfile as any,
            fomapScore: inferred.fomapScore,
            confidence: inferred.confidence,
            lastUpdatedAt: new Date(),
          },
        });
      }

      // Match against ICP
      const match = await matchToICP(profile.id, icpId);

      if (match.score >= minScore) {
        results.push({
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
          companyName: contact.company?.name ?? null,
          profileId: profile.id,
          match,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.match.score - a.match.score);

    return sendSuccess({
      icpId: icp.id,
      icpName: icp.name,
      totalEvaluated: contacts.length,
      matches: results,
    });
  } catch (error: any) {
    console.error("GET /api/icp/[id]/matches error:", error);
    return sendUnhandledError();
  }
}
