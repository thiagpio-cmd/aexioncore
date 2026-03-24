import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

// GET /api/reports/[id] — Read a single saved report
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await params;
    const orgId = (session.user as any).organizationId;

    const report = await prisma.savedReport.findFirst({
      where: { id, organizationId: orgId },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    if (!report) {
      return sendError(notFound("Report"));
    }

    // Parse JSON fields for the response
    const parsed = {
      ...report,
      modules: safeJsonParse(report.modules, []),
      filters: safeJsonParse(report.filters, null),
      content: safeJsonParse(report.content, {}),
    };

    return sendSuccess(parsed);
  } catch (error: unknown) {
    console.error("GET /api/reports/[id] error:", error);
    return sendUnhandledError();
  }
}

// DELETE /api/reports/[id] — Archive a saved report
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await params;
    const orgId = (session.user as any).organizationId;

    const report = await prisma.savedReport.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!report) {
      return sendError(notFound("Report"));
    }

    const updated = await prisma.savedReport.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date(),
      },
    });

    return sendSuccess({ id: updated.id, status: updated.status, archivedAt: updated.archivedAt });
  } catch (error: unknown) {
    console.error("DELETE /api/reports/[id] error:", error);
    return sendUnhandledError();
  }
}

function safeJsonParse(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
