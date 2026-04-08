import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getUsageSummary } from "@/lib/plan-guard";

/**
 * GET /api/admin/usage/[orgId] — Detailed usage for a specific org
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });

  if (!org) return sendError(notFound("Organization"));

  // Get current usage summary
  const summary = await getUsageSummary(orgId);

  // Get historical usage records
  const history = await prisma.usageRecord.findMany({
    where: { organizationId: orgId },
    orderBy: { periodStart: "desc" },
    take: 60, // last 5 months x ~12 metrics
  });

  // Group by period
  const byPeriod: Record<string, any[]> = {};
  for (const record of history) {
    const key = record.periodStart.toISOString().slice(0, 7); // YYYY-MM
    if (!byPeriod[key]) byPeriod[key] = [];
    byPeriod[key].push(record);
  }

  return sendSuccess({
    organization: org,
    current: summary,
    history: byPeriod,
  });
}
