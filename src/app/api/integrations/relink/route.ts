import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, forbidden } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { relinkMessages } from "@/lib/integrations/inbox-ingestion-service";

/**
 * POST /api/integrations/relink
 *
 * Re-run entity resolution on all Gmail messages for the tenant.
 * Useful after adding new contacts/leads to retroactively link messages.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    if (session.user.role !== "ADMIN") {
      return sendError(forbidden("Only admins can relink messages"));
    }

    const result = await relinkMessages(session.user.organizationId);

    return sendSuccess({
      ...result,
      message: `Relinked ${result.updated} messages. ${result.unresolved} remain unresolved.`,
    });
  } catch (error: any) {
    console.error("POST /api/integrations/relink error:", error);
    return sendError({
      name: "InternalServerError",
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: error.message,
    });
  }
}
