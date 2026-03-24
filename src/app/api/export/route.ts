import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { actorFromSession, buildScopeFilter, canPerform } from "@/lib/authorization";

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const orgId = session.user.organizationId;
    const actor = actorFromSession(session)!;

    // VIEWER cannot export
    if (!canPerform(actor, "lead", "view")) {
      return new Response("Forbidden", { status: 403 });
    }

    const type = request.nextUrl.searchParams.get("type") || "leads";

    if (type === "leads") {
      const scopeFilter = buildScopeFilter(actor, "lead");
      const leads = await prisma.lead.findMany({
        where: { organizationId: orgId, ...scopeFilter },
        include: {
          owner: { select: { name: true, email: true } },
          company: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "Name", "Email", "Phone", "Title", "Company", "Source",
        "Status", "Temperature", "Fit Score", "Owner", "Last Contact",
        "Created At", "Updated At",
      ];

      const rows = leads.map((l) => [
        l.name,
        l.email,
        l.phone || "",
        l.title || "",
        l.company?.name || "",
        l.source || "",
        l.status,
        l.temperature,
        String(l.fitScore),
        l.owner?.name || "",
        l.lastContact ? new Date(l.lastContact).toISOString() : "",
        new Date(l.createdAt).toISOString(),
        new Date(l.updatedAt).toISOString(),
      ]);

      const csv = toCSV(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (type === "opportunities") {
      const oppScopeFilter = buildScopeFilter(actor, "opportunity");
      const opportunities = await prisma.opportunity.findMany({
        where: { organizationId: orgId, ...oppScopeFilter },
        include: {
          owner: { select: { name: true } },
          account: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "Title", "Description", "Value", "Stage", "Probability",
        "Account", "Owner", "Expected Close Date",
        "Created At", "Updated At",
      ];

      const rows = opportunities.map((o) => [
        o.title,
        o.description || "",
        String(o.value),
        o.stage,
        String(o.probability),
        o.account?.name || "",
        o.owner?.name || "",
        o.expectedCloseDate ? new Date(o.expectedCloseDate).toISOString() : "",
        new Date(o.createdAt).toISOString(),
        new Date(o.updatedAt).toISOString(),
      ]);

      const csv = toCSV(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="opportunities_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (type === "contacts") {
      const contactScopeFilter = buildScopeFilter(actor, "contact");
      const contacts = await prisma.contact.findMany({
        where: { organizationId: orgId, ...contactScopeFilter },
        include: {
          company: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "Name", "Email", "Phone", "Title", "Company",
        "Created At", "Updated At",
      ];

      const rows = contacts.map((c) => [
        c.name,
        c.email || "",
        c.phone || "",
        c.title || "",
        c.company?.name || "",
        new Date(c.createdAt).toISOString(),
        new Date(c.updatedAt).toISOString(),
      ]);

      const csv = toCSV(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="contacts_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return new Response("Invalid export type. Use: leads, opportunities, contacts", { status: 400 });
  } catch (error: any) {
    console.error("GET /api/export error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
