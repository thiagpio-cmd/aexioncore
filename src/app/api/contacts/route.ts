import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, validationError, badRequest, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { ContactCreateSchema, ContactQuerySchema } from "@/lib/validations/contact";
import { actorFromSession, buildScopeFilter, canPerform } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const sp = request.nextUrl.searchParams;
    const query = ContactQuerySchema.parse({
      page: sp.get("page") || "1",
      limit: sp.get("limit") || "10",
      search: sp.get("search") || undefined,
      companyId: sp.get("companyId") || undefined,
      sortBy: sp.get("sortBy") || "name",
      sortOrder: (sp.get("sortOrder") || "asc") as "asc" | "desc",
    });

    const skip = (query.page - 1) * query.limit;
    const where: any = { organizationId: session.user.organizationId };

    const scopeFilter = buildScopeFilter(actor, "contact");
    Object.assign(where, scopeFilter);

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
        },
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return sendSuccess(contacts, 200, { page: query.page, limit: query.limit, total });
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid query", error.errors));
    console.error("GET /api/contacts error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "contact", "create")) {
      return sendError(forbidden("You don't have permission to create contacts"));
    }

    const body = await request.json();
    const data = ContactCreateSchema.parse(body);

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) return sendError(badRequest("Company not found"));

    const existing = await prisma.contact.findUnique({ where: { email: data.email } });
    if (existing) return sendError(badRequest("Contact with this email already exists"));

    const contact = await prisma.contact.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
      },
      include: { company: { select: { id: true, name: true } } },
    });

    return sendSuccess(contact, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid contact data", error.errors));
    console.error("POST /api/contacts error:", error);
    return sendUnhandledError();
  }
}
