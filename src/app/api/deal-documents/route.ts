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

    let query = `
      SELECT dd.*, o.title as "opportunityTitle"
      FROM deal_documents dd
      LEFT JOIN opportunities o ON dd."opportunityId" = o.id
      WHERE o."organizationId" = $1
    `;
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (opportunityId) {
      query += ` AND dd."opportunityId" = $${paramIdx}`;
      params.push(opportunityId);
      paramIdx++;
    }

    query += ` ORDER BY dd."createdAt" DESC`;

    const documents = await prisma.$queryRawUnsafe(query, ...params);

    return sendSuccess(documents);
  } catch (error: any) {
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return sendSuccess([]);
    }
    console.error("GET /api/deal-documents error:", error);
    return sendUnhandledError();
  }
}
