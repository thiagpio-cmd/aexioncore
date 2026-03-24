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

    const sp = request.nextUrl.searchParams;
    const category = sp.get("category");
    const impact = sp.get("impact");

    const where: any = { organizationId: session.user.organizationId };
    if (category) where.category = category;
    if (impact) where.impact = impact;

    const insights = await prisma.insight.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(insights);
  } catch (error: any) {
    console.error("GET /api/insights error:", error);
    return sendUnhandledError();
  }
}
