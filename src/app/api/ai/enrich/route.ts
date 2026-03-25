import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { geminiProvider } from "@/lib/ai/providers/gemini-provider";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

/**
 * POST /api/ai/enrich
 *
 * LLM-powered enrichment endpoint.
 * Uses Gemini for deeper analysis. Falls back gracefully if unavailable.
 *
 * Body: { task: "synthesize" | "classify_message" | "classify_objections", data: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Require at least SDR role (level 1)
    const roleError = requireRole(session.user as any, "SDR");
    if (roleError) return roleError;

    // Rate limiting per user
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const body = await request.json();
    const { task, data } = body;

    if (!task) return sendError(badRequest("task is required"));

    // Check if Gemini is configured
    if (!geminiProvider.isConfigured()) {
      return sendSuccess({
        result: null,
        provider: "none",
        fallback: true,
        message: "LLM provider not configured (GEMINI_API_KEY missing). Using deterministic fallback.",
      });
    }

    switch (task) {
      case "synthesize": {
        const text = await geminiProvider.synthesizeExecutive(data);
        return sendSuccess({ result: text, provider: "gemini", fallback: false });
      }

      case "classify_message": {
        const classification = await geminiProvider.classifyMessage(data);
        return sendSuccess({ result: classification, provider: "gemini", fallback: false });
      }

      case "classify_objections": {
        const clusters = await geminiProvider.classifyObjections(data.objections ?? []);
        return sendSuccess({ result: clusters, provider: "gemini", fallback: false });
      }

      default:
        return sendError(badRequest(`Unknown task: ${task}`));
    }
  } catch (error: any) {
    console.error("POST /api/ai/enrich error:", error);

    // Graceful fallback — LLM failure should never break the product
    return sendSuccess({
      result: null,
      provider: "none",
      fallback: true,
      message: `LLM enrichment failed: ${error.message}. Deterministic analysis remains available.`,
    });
  }
}
