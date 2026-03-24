import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

// GET /api/reports — List saved reports for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const orgId = (session.user as any).organizationId;
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const status = searchParams.get("status") || undefined;

    const where: Record<string, unknown> = {
      organizationId: orgId,
    };
    if (status) {
      where.status = status;
    } else {
      // By default exclude archived
      where.status = { not: "archived" };
    }

    const [reports, total] = await Promise.all([
      prisma.savedReport.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          reportType: true,
          period: true,
          modules: true,
          status: true,
          generatedAt: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { generatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.savedReport.count({ where }),
    ]);

    return sendSuccess(reports, 200, { page, limit, total });
  } catch (error: unknown) {
    console.error("GET /api/reports error:", error);
    return sendUnhandledError();
  }
}

// POST /api/reports — Save a generated report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Reports creation requires at least MANAGER role
    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const orgId = (session.user as any).organizationId;
    const userId = (session.user as any).id;
    const body = await request.json();

    const {
      title,
      description,
      reportType,
      period,
      periodStart,
      periodEnd,
      modules,
      filters,
      content,
    } = body;

    if (!title || !reportType || !period || !modules || !content) {
      return sendError(
        badRequest(
          "Required fields: title, reportType, period, modules, content"
        )
      );
    }

    const report = await prisma.savedReport.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        title,
        description: description || null,
        reportType,
        period,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        modules:
          typeof modules === "string" ? modules : JSON.stringify(modules),
        filters: filters
          ? typeof filters === "string"
            ? filters
            : JSON.stringify(filters)
          : null,
        content:
          typeof content === "string" ? content : JSON.stringify(content),
        status: "generated",
        generatedAt: new Date(),
      },
    });

    return sendSuccess(report, 201);
  } catch (error: unknown) {
    console.error("POST /api/reports error:", error);
    return sendUnhandledError();
  }
}
