import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { RecommendationEngine } from "@/lib/intelligence/recommendation-engine";
import { buildScopeFilter, actorFromSession } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const orgId = session.user.organizationId;

    const sp = request.nextUrl.searchParams;
    const entityType = sp.get("entityType") ?? undefined;
    const entityId = sp.get("entityId") ?? undefined;
    const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 20;

    // We can use the opportunity scope filter for recommendations since recommendations
    // are heavily tied to opportunities and leads.
    const oppScope = buildScopeFilter(actor, "opportunity");
    const ownerId = oppScope.ownerId;

    const engine = new RecommendationEngine();
    const recommendations = await engine.generateRecommendations(orgId, {
      entityType,
      entityId,
      ownerId,
      limit,
    });

    return sendSuccess({ recommendations, total: recommendations.length });
  } catch (error: unknown) {
    console.error("GET /api/recommendations error:", error);
    return sendUnhandledError();
  }
}
