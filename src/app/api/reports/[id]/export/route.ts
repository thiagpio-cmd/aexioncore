import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

// GET /api/reports/[id]/export?format=csv|json — Export a saved report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const { id } = await params;
    const orgId = (session.user as any).organizationId;
    const format = request.nextUrl.searchParams.get("format") || "json";

    if (!["csv", "json"].includes(format)) {
      return sendError(badRequest("format must be csv or json"));
    }

    const report = await prisma.savedReport.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!report) {
      return sendError(notFound("Report"));
    }

    const content = safeJsonParse(report.content, {});
    const filename = `report-${report.id}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      return new NextResponse(JSON.stringify(content, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV: flatten sections into rows
    const csvRows: string[] = [];
    csvRows.push(
      [
        "section_id",
        "section_title",
        "section_type",
        "content",
        "source",
        "confidence",
      ]
        .map(escapeCSV)
        .join(",")
    );

    const reportData = content as Record<string, unknown>;
    const sections = (reportData.sections || []) as Array<Record<string, unknown>>;

    for (const section of sections) {
      csvRows.push(
        [
          String(section.id || ""),
          String(section.title || ""),
          String(section.type || ""),
          String(section.content || ""),
          String(section.source || ""),
          String(section.confidence || ""),
        ]
          .map(escapeCSV)
          .join(",")
      );
    }

    // Add executive synthesis as a special row
    const synthesis = reportData.executiveSynthesis as
      | Record<string, unknown>
      | undefined;
    if (synthesis) {
      csvRows.push(
        [
          "executive_synthesis",
          "Executive Synthesis",
          "summary",
          String(synthesis.summary || ""),
          "template_heuristic",
          "",
        ]
          .map(escapeCSV)
          .join(",")
      );
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/reports/[id]/export error:", error);
    return sendUnhandledError();
  }
}

function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function safeJsonParse(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
