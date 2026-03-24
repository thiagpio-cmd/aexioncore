import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { timelineEngine, type TimelineEventType, type TimelineEvent } from "@/lib/timeline/timeline-engine";
import { buildScopeFilter, actorFromSession } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const contactId = searchParams.get("contactId") || undefined;
    const companyId = searchParams.get("companyId") || undefined;
    
    // Default to the role's scope for opportunities/leads as the baseline for timeline visibility
    const oppScope = buildScopeFilter(actor, "opportunity");
    let ownerId = searchParams.get("ownerId") || undefined;
    
    // If the scope restricts to ownerId, override any requested ownerId
    if (oppScope.ownerId) {
      ownerId = oppScope.ownerId;
    }

    const typesParam = searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as TimelineEventType[])
      : undefined;

    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam
      ? (categoriesParam.split(",").filter(Boolean) as TimelineEvent["category"][])
      : undefined;

    const channelsParam = searchParams.get("channels");
    const channels = channelsParam
      ? channelsParam.split(",").filter(Boolean)
      : undefined;

    const sourcesParam = searchParams.get("sources");
    const sources = sourcesParam
      ? sourcesParam.split(",").filter(Boolean)
      : undefined;

    const dateFromParam = searchParams.get("dateFrom");
    const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;

    const dateToParam = searchParams.get("dateTo");
    const dateTo = dateToParam ? new Date(dateToParam) : undefined;

    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await timelineEngine.getTimeline({
      entityType,
      entityId,
      contactId,
      companyId,
      ownerId,
      organizationId: session.user.organizationId,
      types,
      categories,
      channels,
      sources,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return sendSuccess({
      events: result.events,
      total: result.total,
    });
  } catch (error) {
    console.error("[Timeline API] Error:", error);
    return sendUnhandledError();
  }
}
