import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { MeetingCreateSchema, MeetingQuerySchema } from "@/lib/validations/meeting";
import { buildScopeFilter, actorFromSession, canPerform } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const query = MeetingQuerySchema.parse({
      page: sp.get("page") || "1",
      limit: sp.get("limit") || "10",
      search: sp.get("search") || undefined,
      ownerId: sp.get("ownerId") || undefined,
      sortBy: sp.get("sortBy") || "startTime",
      sortOrder: (sp.get("sortOrder") || "asc") as "asc" | "desc",
    });

    const skip = (query.page - 1) * query.limit;
    
    const scopeFilter = buildScopeFilter(actor, "meeting");
    const where: any = { 
      organizationId: session.user.organizationId,
      ...scopeFilter
    };

    if (query.search) where.title = { contains: query.search, mode: "insensitive" };
    // Allow managers/admins to filter by ownerId, but not override an existing scope ownerId restricted by RBAC
    if (query.ownerId && !scopeFilter.ownerId) {
      where.ownerId = query.ownerId;
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, name: true } },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.meeting.count({ where }),
    ]);

    return sendSuccess(meetings, 200, { page: query.page, limit: query.limit, total });
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid query", error.errors));
    console.error("GET /api/meetings error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor || !canPerform(actor, "meeting", "create")) {
      return sendError(forbidden("You do not have permission to create meetings"));
    }

    const body = await request.json();
    const data = MeetingCreateSchema.parse(body);

    const meeting = await prisma.meeting.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
      },
      include: {
        owner: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(meeting, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid meeting data", error.errors));
    console.error("POST /api/meetings error:", error);
    return sendUnhandledError();
  }
}
