import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { TaskCreateSchema, TaskQuerySchema } from "@/lib/validations/task";
import { auditCreate } from "@/server/audit";
import { actorFromSession, buildScopeFilter, canPerform } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const query = TaskQuerySchema.parse({
      page: sp.get("page") || "1",
      limit: sp.get("limit") || "20",
      search: sp.get("search") || undefined,
      status: sp.get("status") || undefined,
      priority: sp.get("priority") || undefined,
      type: sp.get("type") || undefined,
      ownerId: sp.get("ownerId") || undefined,
      sortBy: sp.get("sortBy") || "dueDate",
      sortOrder: (sp.get("sortOrder") || "asc") as "asc" | "desc",
    });

    const skip = (query.page - 1) * query.limit;
    const where: any = { organizationId: session.user.organizationId };

    if (query.search) where.title = { contains: query.search, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.type) where.type = query.type;

    // Centralized authorization: scope-based filtering
    const scopeFilter = buildScopeFilter(actor, "task");
    Object.assign(where, scopeFilter);

    // If user has broader scope and wants to filter by owner, allow it
    if (!scopeFilter.ownerId && query.ownerId) {
      where.ownerId = query.ownerId;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true } },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.task.count({ where }),
    ]);

    return sendSuccess(tasks, 200, { page: query.page, limit: query.limit, total });
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid query", error.errors));
    console.error("GET /api/tasks error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "task", "create")) {
      return sendError(forbidden("You don't have permission to create tasks"));
    }

    const body = await request.json();
    const data = TaskCreateSchema.parse(body);

    const task = await prisma.task.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    auditCreate(session.user.organizationId, session.user.id, "Task", task.id, { title: task.title });
    return sendSuccess(task, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid task data", error.errors));
    console.error("POST /api/tasks error:", error);
    return sendUnhandledError();
  }
}
