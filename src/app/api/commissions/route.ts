import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const orgId = session.user.organizationId;
    const url = new URL(request.url);
    const opportunityId = url.searchParams.get("opportunityId");
    const status = url.searchParams.get("status");

    let query = `
      SELECT c.*, o.title as "opportunityTitle", o.value as "dealValue", u.name as "agentName"
      FROM commissions c
      LEFT JOIN opportunities o ON c."opportunityId" = o.id
      LEFT JOIN users u ON c."agentId" = u.id
      WHERE o."organizationId" = $1
    `;
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (opportunityId) {
      query += ` AND c."opportunityId" = $${paramIdx}`;
      params.push(opportunityId);
      paramIdx++;
    }
    if (status) {
      query += ` AND c.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    query += ` ORDER BY c."createdAt" DESC`;

    const commissions = await prisma.$queryRawUnsafe(query, ...params);

    // Calculate summary
    const all = commissions as any[];
    const summary = {
      total: all.length,
      totalGross: all.reduce((s: number, c: any) => s + (parseFloat(c.grossAmount) || 0), 0),
      totalNet: all.reduce((s: number, c: any) => s + (parseFloat(c.netAmount) || 0), 0),
      pending: all.filter((c: any) => c.status === "PENDING").length,
      pendingAmount: all.filter((c: any) => c.status === "PENDING").reduce((s: number, c: any) => s + (parseFloat(c.grossAmount) || 0), 0),
      earned: all.filter((c: any) => c.status === "EARNED").length,
      paid: all.filter((c: any) => c.status === "PAID").length,
      paidAmount: all.filter((c: any) => c.status === "PAID").reduce((s: number, c: any) => s + (parseFloat(c.grossAmount) || 0), 0),
    };

    return sendSuccess({ commissions: all, summary });
  } catch (error: any) {
    // Table might not exist yet
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return sendSuccess({ commissions: [], summary: { total: 0, totalGross: 0, totalNet: 0, pending: 0, pendingAmount: 0, earned: 0, paid: 0, paidAmount: 0 } });
    }
    console.error("GET /api/commissions error:", error);
    return sendUnhandledError();
  }
}
