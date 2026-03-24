import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import {
  sendSuccess,
  sendError,
  sendUnhandledError,
} from "@/lib/api-response";
import {
  unauthorized,
  validationError,
  badRequest,
  forbidden,
} from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { AccountCreateSchema, AccountQuerySchema } from "@/lib/validations/account";
import { actorFromSession, buildScopeFilter, canPerform } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return sendError(unauthorized());
    }

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
    };

    const query = AccountQuerySchema.parse(queryData);
    const skip = (query.page - 1) * query.limit;

    const where: any = {
      organizationId: session.user.organizationId,
    };

    const scopeFilter = buildScopeFilter(actor, "account");
    Object.assign(where, scopeFilter);

    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }

    if (query.status) {
      where.status = query.status;
    }

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, industry: true } },
          opportunities: {
            select: { id: true, title: true, value: true, stage: true },
          },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.account.count({ where }),
    ]);

    return sendSuccess(accounts, 200, {
      page: query.page,
      limit: query.limit,
      total,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return sendError(validationError("Invalid query parameters", error.errors));
    }
    console.error("GET /api/accounts error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return sendError(unauthorized());
    }

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "account", "create")) {
      return sendError(forbidden("You don't have permission to create accounts"));
    }

    const body = await request.json();
    const data = AccountCreateSchema.parse(body);

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    });

    if (!company) {
      return sendError(badRequest("Company not found"));
    }

    const account = await prisma.account.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(account, 201);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return sendError(validationError("Invalid account data", error.errors));
    }
    console.error("POST /api/accounts error:", error);
    return sendUnhandledError();
  }
}
