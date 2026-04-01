import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError, badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/icp/[id]
 *
 * Returns a specific ICP profile.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "view", { organizationId: actor.organizationId })) {
      return sendError(forbidden("No permission to view ICPs"));
    }

    const { id } = await ctx.params;

    const icp = await prisma.iCPProfile.findUnique({
      where: { id },
      include: {
        _count: {
          select: { icpScores: true },
        },
      },
    });

    if (!icp || icp.organizationId !== actor.organizationId) {
      return sendError(notFound("ICP Profile"));
    }

    return sendSuccess(icp);
  } catch (error: any) {
    console.error("GET /api/icp/[id] error:", error);
    return sendUnhandledError();
  }
}

/**
 * PUT /api/icp/[id]
 *
 * Updates an existing ICP profile.
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "edit", { organizationId: actor.organizationId })) {
      return sendError(forbidden("No permission to edit ICPs"));
    }

    const { id } = await ctx.params;

    // Verify ownership
    const existing = await prisma.iCPProfile.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!existing || existing.organizationId !== actor.organizationId) {
      return sendError(notFound("ICP Profile"));
    }

    const body = await request.json();

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return sendError(badRequest("Field 'name' cannot be empty"));
      }
    }

    // Validate psychographic fields
    if (body.bigFiveProfile) {
      try {
        const parsed = typeof body.bigFiveProfile === "string"
          ? JSON.parse(body.bigFiveProfile)
          : body.bigFiveProfile;
        const validKeys = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"];
        for (const key of Object.keys(parsed)) {
          if (!validKeys.includes(key)) {
            return sendError(validationError(`Invalid Big Five dimension: ${key}`));
          }
          if (typeof parsed[key] !== "number" || parsed[key] < 0 || parsed[key] > 10) {
            return sendError(validationError(`Big Five '${key}' must be between 0-10`));
          }
        }
        body.bigFiveProfile = typeof body.bigFiveProfile === "string"
          ? body.bigFiveProfile
          : JSON.stringify(body.bigFiveProfile);
      } catch {
        return sendError(validationError("bigFiveProfile must be valid JSON"));
      }
    }

    if (body.motivationProfile) {
      try {
        const parsed = typeof body.motivationProfile === "string"
          ? JSON.parse(body.motivationProfile)
          : body.motivationProfile;
        const validKeys = ["autonomy", "competence", "relatedness"];
        for (const key of Object.keys(parsed)) {
          if (!validKeys.includes(key)) {
            return sendError(validationError(`Invalid SDT dimension: ${key}`));
          }
          if (typeof parsed[key] !== "number" || parsed[key] < 0 || parsed[key] > 100) {
            return sendError(validationError(`SDT '${key}' must be between 0-100`));
          }
        }
        body.motivationProfile = typeof body.motivationProfile === "string"
          ? body.motivationProfile
          : JSON.stringify(body.motivationProfile);
      } catch {
        return sendError(validationError("motivationProfile must be valid JSON"));
      }
    }

    if (body.decisionStyle) {
      const valid = ["ANALYTICAL", "INTUITIVE", "CONSENSUS", "AUTHORITATIVE"];
      if (!valid.includes(body.decisionStyle)) {
        return sendError(validationError(`decisionStyle must be one of: ${valid.join(", ")}`));
      }
    }

    if (body.riskTolerance) {
      const valid = ["LOW", "MEDIUM", "HIGH"];
      if (!valid.includes(body.riskTolerance)) {
        return sendError(validationError(`riskTolerance must be one of: ${valid.join(", ")}`));
      }
    }

    if (body.valueDrivers) {
      try {
        const parsed = typeof body.valueDrivers === "string"
          ? JSON.parse(body.valueDrivers)
          : body.valueDrivers;
        if (!Array.isArray(parsed)) {
          return sendError(validationError("valueDrivers must be an array"));
        }
        body.valueDrivers = typeof body.valueDrivers === "string"
          ? body.valueDrivers
          : JSON.stringify(body.valueDrivers);
      } catch {
        return sendError(validationError("valueDrivers must be valid JSON"));
      }
    }

    if (body.idealIndustries) {
      body.idealIndustries = typeof body.idealIndustries === "string"
        ? body.idealIndustries
        : JSON.stringify(body.idealIndustries);
    }

    const updateData: Record<string, any> = {};
    const allowedFields = [
      "name", "isActive",
      "idealIndustries", "idealCompanySizeMin", "idealCompanySizeMax",
      "idealAnnualRevenueMinBRL", "idealAnnualRevenueMaxBRL",
      "bigFiveProfile", "motivationProfile", "decisionStyle",
      "riskTolerance", "valueDrivers",
      "avgDealValueBRL", "avgSalesCycleDays", "avgWinRate",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === "name" ? body[field].trim() : body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return sendError(badRequest("No fields to update"));
    }

    const updated = await prisma.iCPProfile.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { icpScores: true },
        },
      },
    });

    return sendSuccess(updated);
  } catch (error: any) {
    console.error("PUT /api/icp/[id] error:", error);
    return sendUnhandledError();
  }
}

/**
 * DELETE /api/icp/[id]
 *
 * Deactivates (soft-delete) an ICP profile.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "delete", { organizationId: actor.organizationId })) {
      return sendError(forbidden("No permission to delete ICPs"));
    }

    const { id } = await ctx.params;

    const existing = await prisma.iCPProfile.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!existing || existing.organizationId !== actor.organizationId) {
      return sendError(notFound("ICP Profile"));
    }

    // Soft delete — mark as inactive
    await prisma.iCPProfile.update({
      where: { id },
      data: { isActive: false },
    });

    return sendSuccess({ message: "ICP Profile deactivated" });
  } catch (error: any) {
    console.error("DELETE /api/icp/[id] error:", error);
    return sendUnhandledError();
  }
}
