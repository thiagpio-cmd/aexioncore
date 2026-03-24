import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const playbooks = await prisma.playbook.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(playbooks);
  } catch (error: any) {
    console.error("GET /api/playbooks error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const body = await request.json();
    const { name, description, segment, stage, steps } = body;

    if (!name?.trim()) return sendError(badRequest("name is required"));

    const playbook = await prisma.playbook.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        description: description || null,
        segment: segment || null,
        stage: stage || null,
        steps: steps?.length > 0 ? {
          create: steps.map((s: any, i: number) => ({
            order: i + 1,
            title: s.title || `Step ${i + 1}`,
            description: s.description || null,
            resources: s.resources || null,
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    return sendSuccess(playbook, 201);
  } catch (error: any) {
    console.error("POST /api/playbooks error:", error);
    return sendUnhandledError();
  }
}
