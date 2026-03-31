import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";
import { inferProfile } from "@/lib/intelligence/icp-engine";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/profile
 *
 * Retorna o perfil psicografico do contato.
 * Se nao existir, infere automaticamente a partir dos dados comportamentais.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id: contactId } = await ctx.params;

    // Verify contact exists and tenant isolation
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, organizationId: true, name: true },
    });

    if (!contact) return sendError(notFound("Contato"));
    if (!canPerform(actor, "contact", "view", { organizationId: contact.organizationId ?? undefined })) {
      return sendError(forbidden("Sem permissao para visualizar este contato"));
    }

    const organizationId = contact.organizationId ?? actor.organizationId;

    // Check for existing profile
    let profile = await prisma.customerProfile.findUnique({
      where: { contactId_organizationId: { contactId, organizationId } },
    });

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    if (!profile || forceRefresh) {
      // Infer profile from behavioral data
      const inferred = await inferProfile(contactId, organizationId);

      if (profile && forceRefresh) {
        profile = await prisma.customerProfile.update({
          where: { id: profile.id },
          data: {
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
      } else if (!profile) {
        profile = await prisma.customerProfile.create({
          data: {
            contactId,
            organizationId,
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
    }

    return sendSuccess({
      profile,
      contact: { id: contact.id, name: contact.name },
    });
  } catch (error: any) {
    console.error("GET /api/contacts/[id]/profile error:", error);
    return sendUnhandledError();
  }
}
