import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, validationError, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        stages: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, order: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(pipelines);
  } catch (error: any) {
    console.error("GET /api/pipelines error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();

    if (!body.name?.trim()) {
      return sendError(badRequest("Pipeline name is required"));
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        organizationId: session.user.organizationId,
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, order: true, color: true },
        },
      },
    });

    // Create default stages if requested
    if (body.defaultStages !== false) {
      const defaultStages = [
        { name: "Discovery", order: 1, color: "#6366f1" },
        { name: "Qualification", order: 2, color: "#8b5cf6" },
        { name: "Proposal", order: 3, color: "#a855f7" },
        { name: "Negotiation", order: 4, color: "#f59e0b" },
        { name: "Closed Won", order: 5, color: "#22c55e" },
        { name: "Closed Lost", order: 6, color: "#ef4444" },
      ];

      await prisma.stage.createMany({
        data: defaultStages.map((s) => ({
          ...s,
          pipelineId: pipeline.id,
        })),
      });

      // Re-fetch with stages
      const pipelineWithStages = await prisma.pipeline.findUnique({
        where: { id: pipeline.id },
        include: {
          stages: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, order: true, color: true },
          },
        },
      });

      return sendSuccess(pipelineWithStages, 201);
    }

    return sendSuccess(pipeline, 201);
  } catch (error: any) {
    console.error("POST /api/pipelines error:", error);
    return sendUnhandledError();
  }
}
