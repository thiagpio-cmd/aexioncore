import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { OpportunityCreateSchema, OpportunityQuerySchema } from "@/lib/validations/opportunity";
import { auditCreate } from "@/server/audit";
import { actorFromSession, buildScopeFilter, canPerform } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const query = OpportunityQuerySchema.parse({
      page: sp.get("page") || "1",
      limit: sp.get("limit") || "10",
      search: sp.get("search") || undefined,
      stage: sp.get("stage") || undefined,
      ownerId: sp.get("ownerId") || undefined,
      accountId: sp.get("accountId") || undefined,
      sortBy: sp.get("sortBy") || "createdAt",
      sortOrder: (sp.get("sortOrder") || "desc") as "asc" | "desc",
    });

    const skip = (query.page - 1) * query.limit;
    const where: any = { organizationId: session.user.organizationId };

    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }
    if (query.stage) where.stage = query.stage;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.accountId) where.accountId = query.accountId;

    // Centralized authorization: scope-based filtering
    const scopeFilter = buildScopeFilter(actor, "opportunity");
    Object.assign(where, scopeFilter);

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          stageRelation: { select: { id: true, name: true, color: true } },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.opportunity.count({ where }),
    ]);

    return sendSuccess(opportunities, 200, { page: query.page, limit: query.limit, total });
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid query", error.errors));
    console.error("GET /api/opportunities error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "opportunity", "create")) {
      return sendError(forbidden("You don't have permission to create opportunities"));
    }

    const body = await request.json();
    const data = OpportunityCreateSchema.parse(body);

    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account) return sendError(badRequest("Account not found"));

    const owner = await prisma.user.findUnique({ where: { id: data.ownerId } });
    if (!owner) return sendError(badRequest("Owner not found"));

    const opportunity = await prisma.opportunity.create({
      data: {
        ...data,
        ownerName: owner.name,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        organizationId: session.user.organizationId,
      },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    auditCreate(session.user.organizationId, session.user.id, "Opportunity", opportunity.id, { title: opportunity.title, value: opportunity.value, stage: opportunity.stage });
    return sendSuccess(opportunity, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid opportunity data", error.errors));
    console.error("POST /api/opportunities error:", error);
    return sendUnhandledError();
  }
}
