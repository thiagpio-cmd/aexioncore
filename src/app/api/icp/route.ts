import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, validationError, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { actorFromSession, canPerform } from "@/lib/authorization";

/**
 * GET /api/icp
 *
 * Lists active ICP profiles for the organization.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "view", { organizationId: actor.organizationId })) {
      return sendError(forbidden("No permission to view ICPs"));
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const icps = await prisma.iCPProfile.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { icpScores: true },
        },
      },
    });

    return sendSuccess(icps);
  } catch (error: any) {
    console.error("GET /api/icp error:", error);
    return sendUnhandledError();
  }
}

/**
 * POST /api/icp
 *
 * Creates a new ICP profile with psychographic template.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    if (!canPerform(actor, "analytics", "create", { organizationId: actor.organizationId })) {
      return sendError(forbidden("No permission to create ICPs"));
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return sendError(badRequest("Field 'name' is required"));
    }

    // Validate psychographic template structure if provided
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

    // Validate decisionStyle
    if (body.decisionStyle) {
      const valid = ["ANALYTICAL", "INTUITIVE", "CONSENSUS", "AUTHORITATIVE"];
      if (!valid.includes(body.decisionStyle)) {
        return sendError(validationError(`decisionStyle must be one of: ${valid.join(", ")}`));
      }
    }

    // Validate riskTolerance
    if (body.riskTolerance) {
      const valid = ["LOW", "MEDIUM", "HIGH"];
      if (!valid.includes(body.riskTolerance)) {
        return sendError(validationError(`riskTolerance must be one of: ${valid.join(", ")}`));
      }
    }

    // Validate valueDrivers
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

    const icp = await prisma.iCPProfile.create({
      data: {
        organizationId: actor.organizationId,
        name: body.name.trim(),
        isActive: body.isActive ?? true,
        // Firmographic
        idealIndustries: body.idealIndustries
          ? (typeof body.idealIndustries === "string" ? body.idealIndustries : JSON.stringify(body.idealIndustries))
          : undefined,
        idealCompanySizeMin: body.idealCompanySizeMin ?? undefined,
        idealCompanySizeMax: body.idealCompanySizeMax ?? undefined,
        idealAnnualRevenueMinBRL: body.idealAnnualRevenueMinBRL ?? undefined,
        idealAnnualRevenueMaxBRL: body.idealAnnualRevenueMaxBRL ?? undefined,
        // Psychographic
        bigFiveProfile: body.bigFiveProfile ?? undefined,
        motivationProfile: body.motivationProfile ?? undefined,
        decisionStyle: body.decisionStyle ?? undefined,
        riskTolerance: body.riskTolerance ?? undefined,
        valueDrivers: body.valueDrivers ?? undefined,
        // Benchmarks
        avgDealValueBRL: body.avgDealValueBRL ?? undefined,
        avgSalesCycleDays: body.avgSalesCycleDays ?? undefined,
        avgWinRate: body.avgWinRate ?? undefined,
      },
    });

    return sendSuccess(icp, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid data", error.errors));
    console.error("POST /api/icp error:", error);
    return sendUnhandledError();
  }
}
