/**
 * POST /api/debriefs — Create a new Smart Debrief
 * GET  /api/debriefs — List debriefs for user's organization
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform, buildScopeFilter } from "@/lib/authorization";
import { processDebrief } from "@/lib/intelligence/debrief-service";
import { auditCreate } from "@/server/audit";

// ─── POST — Create debrief ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "edit")) {
      return sendError(forbidden("No permission to create debriefs"));
    }

    const body = await request.json();

    if (!body.text || typeof body.text !== "string" || body.text.trim().length < 10) {
      return sendError(badRequest("Field 'text' must have at least 10 characters"));
    }

    if (!body.opportunityId || typeof body.opportunityId !== "string") {
      return sendError(badRequest("Field 'opportunityId' is required"));
    }

    // Verify opportunity exists and belongs to this org
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: body.opportunityId },
      select: { id: true, organizationId: true, ownerId: true },
    });

    if (!opportunity) {
      return sendError(badRequest("Opportunity not found"));
    }

    if (opportunity.organizationId !== session.user.organizationId) {
      return sendError(forbidden("Access denied to this opportunity"));
    }

    // Check user can access this opportunity
    if (!canPerform(actor, "opportunity", "edit", {
      ownerId: opportunity.ownerId,
      organizationId: opportunity.organizationId,
    })) {
      return sendError(forbidden("No permission for this opportunity"));
    }

    const result = await processDebrief({
      text: body.text.trim(),
      opportunityId: body.opportunityId,
      userId: session.user.id,
      orgId: session.user.organizationId,
    });

    auditCreate(
      session.user.organizationId,
      session.user.id,
      "Debrief",
      result.debrief.id,
      { opportunityId: body.opportunityId, proposalCount: result.proposals.length }
    );

    return sendSuccess(result, 201);
  } catch (error: any) {
    console.error("POST /api/debriefs error:", error);
    if (error.message?.includes("not found") || error.message?.includes("denied")) {
      return sendError(badRequest(error.message));
    }
    return sendUnhandledError();
  }
}

// ─── GET — List debriefs ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "10", 10)));
    const opportunityId = sp.get("opportunityId") || undefined;
    const status = sp.get("status") || undefined;

    const where: any = { organizationId: session.user.organizationId };

    // Apply scope-based filtering (own/team/org) using existing auth pattern
    const scopeFilter = buildScopeFilter(actor, "opportunity");
    if (scopeFilter.ownerId) {
      where.userId = scopeFilter.ownerId;
    }

    if (opportunityId) where.opportunityId = opportunityId;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [debriefs, total] = await Promise.all([
      prisma.debrief.findMany({
        where,
        include: {
          opportunity: { select: { id: true, title: true, value: true, stage: true } },
          user: { select: { id: true, name: true } },
          actionProposals: {
            select: {
              id: true,
              actionType: true,
              description: true,
              urgency: true,
              financialImpact: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.debrief.count({ where }),
    ]);

    return sendSuccess(debriefs, 200, { page, limit, total });
  } catch (error: any) {
    console.error("GET /api/debriefs error:", error);
    return sendUnhandledError();
  }
}
