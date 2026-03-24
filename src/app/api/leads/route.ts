import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import {
  sendSuccess,
  sendError,
  sendUnhandledError,
} from "@/lib/api-response";
import {
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  serverError,
} from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { LeadCreateSchema, LeadQuerySchema } from "@/lib/validations/lead";
import { auditCreate } from "@/server/audit";
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
      temperature: searchParams.get("temperature") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
    };

    const query = LeadQuerySchema.parse(queryData);
    const skip = (query.page - 1) * query.limit;

    // Build filter
    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.temperature) {
      where.temperature = query.temperature;
    }

    // Centralized authorization: scope-based filtering
    const scopeFilter = buildScopeFilter(actor, "lead");
    Object.assign(where, scopeFilter);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.lead.count({ where }),
    ]);

    return sendSuccess(leads, 200, {
      page: query.page,
      limit: query.limit,
      total,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return sendError(validationError("Invalid query parameters", error.errors));
    }
    console.error("GET /api/leads error:", error);
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

    if (!canPerform(actor, "lead", "create")) {
      return sendError(forbidden("You don't have permission to create leads"));
    }

    const body = await request.json();
    const data = LeadCreateSchema.parse(body);

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    });

    if (!company) {
      return sendError(badRequest("Company not found"));
    }

    // Check if email already exists
    const existingLead = await prisma.lead.findUnique({
      where: { email: data.email },
    });

    if (existingLead) {
      return sendError(badRequest("Lead with this email already exists"));
    }

    const lead = await prisma.lead.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    auditCreate(session.user.organizationId, session.user.id, "Lead", lead.id, { name: lead.name, email: lead.email });
    return sendSuccess(lead, 201);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return sendError(validationError("Invalid lead data", error.errors));
    }
    console.error("POST /api/leads error:", error);
    return sendUnhandledError();
  }
}
