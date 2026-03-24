import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, buildScopeFilter } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // VIEWER cannot search
    if (session.user.role === "VIEWER") return sendError(forbidden("Viewers cannot search"));

    const actor = actorFromSession(session)!;
    const scopeFilter = buildScopeFilter(actor, "lead");

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return sendSuccess({ leads: [], opportunities: [], contacts: [], accounts: [] });
    }

    const orgId = session.user.organizationId;

    // Search across all entity types in parallel
    const [leads, opportunities, contacts, accounts] = await Promise.all([
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          ...scopeFilter,
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          temperature: true,
          owner: { select: { name: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.opportunity.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          value: true,
          stage: true,
          probability: true,
          owner: { select: { name: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contact.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          title: true,
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.account.findMany({
        where: {
          organizationId: orgId,
          name: { contains: q },
        },
        select: {
          id: true,
          name: true,
          status: true,
          company: { select: { name: true, industry: true, website: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return sendSuccess({
      leads,
      opportunities,
      contacts,
      accounts,
      totalResults: leads.length + opportunities.length + contacts.length + accounts.length,
    });
  } catch (error: any) {
    console.error("GET /api/search error:", error);
    return sendUnhandledError();
  }
}
