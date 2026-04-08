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
    const propertyType = url.searchParams.get("propertyType");
    const state = url.searchParams.get("state");

    let query = `
      SELECT pc.*
      FROM property_comps pc
      WHERE pc."organizationId" = $1
    `;
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (opportunityId) {
      query += ` AND pc."opportunityId" = $${paramIdx}`;
      params.push(opportunityId);
      paramIdx++;
    }
    if (propertyType) {
      query += ` AND pc."propertyType" = $${paramIdx}`;
      params.push(propertyType);
      paramIdx++;
    }
    if (state) {
      query += ` AND pc.state = $${paramIdx}`;
      params.push(state);
      paramIdx++;
    }

    query += ` ORDER BY pc."closedDate" DESC NULLS LAST`;

    const comps = await prisma.$queryRawUnsafe(query, ...params);

    return sendSuccess(comps);
  } catch (error: any) {
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return sendSuccess([]);
    }
    console.error("GET /api/property-comps error:", error);
    return sendUnhandledError();
  }
}
