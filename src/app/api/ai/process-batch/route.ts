import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

/**
 * POST /api/ai/process-batch
 *
 * Batch processing endpoint that fetches unprocessed activities or inbox messages
 * and triggers AI processing for each one. Useful for re-processing existing data
 * or catching up after downtime.
 *
 * Body: { entityType: 'activity' | 'inbox', limit?: number }
 *
 * "Unprocessed" means no AI_SUMMARY activity exists referencing the entity ID.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limiting
    const rateKey = `ai:${(session.user as any).id || getClientIp(request)}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const body = await request.json();
    const { entityType, limit = 20 } = body;

    if (!entityType || !["activity", "inbox"].includes(entityType)) {
      return sendError(badRequest("entityType must be 'activity' or 'inbox'"));
    }

    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const organizationId = session.user.organizationId;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    let triggered = 0;
    let skipped = 0;

    if (entityType === "activity") {
      // Fetch recent activities
      const activities = await prisma.activity.findMany({
        where: {
          organizationId,
          type: { not: "AI_SUMMARY" },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: clampedLimit,
      });

      // Find which ones already have AI_SUMMARY records
      const activityIds = activities.map((a) => a.id);
      const existingSummaries = await prisma.activity.findMany({
        where: {
          organizationId,
          type: "AI_SUMMARY",
          subject: { in: activityIds.map((id) => `AI Analysis [${id}]`) },
        },
        select: { subject: true },
      });

      const processedIds = new Set(
        existingSummaries
          .map((s) => {
            const match = s.subject?.match(/\[([^\]]+)\]/);
            return match ? match[1] : null;
          })
          .filter(Boolean)
      );

      for (const activity of activities) {
        if (processedIds.has(activity.id)) {
          skipped++;
          continue;
        }

        // Fire-and-forget AI processing
        fetch(`${baseUrl}/api/ai/process-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId: activity.id }),
        }).catch(() => {});

        triggered++;
      }
    } else {
      // entityType === "inbox"
      const messages = await prisma.inboxMessage.findMany({
        where: { organizationId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: clampedLimit,
      });

      // Find which ones already have AI_SUMMARY records
      const messageIds = messages.map((m) => m.id);
      const existingSummaries = await prisma.activity.findMany({
        where: {
          organizationId,
          type: "AI_SUMMARY",
          subject: { in: messageIds.map((id) => `AI Analysis [inbox:${id}]`) },
        },
        select: { subject: true },
      });

      const processedIds = new Set(
        existingSummaries
          .map((s) => {
            const match = s.subject?.match(/\[inbox:([^\]]+)\]/);
            return match ? match[1] : null;
          })
          .filter(Boolean)
      );

      for (const message of messages) {
        if (processedIds.has(message.id)) {
          skipped++;
          continue;
        }

        // Fire-and-forget AI processing
        fetch(`${baseUrl}/api/ai/process-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inboxMessageId: message.id }),
        }).catch(() => {});

        triggered++;
      }
    }

    console.log(`[AI ProcessBatch] entityType=${entityType} triggered=${triggered} skipped=${skipped}`);

    return sendSuccess({
      entityType,
      triggered,
      skipped,
      total: triggered + skipped,
    });
  } catch (error: any) {
    console.error("POST /api/ai/process-batch error:", error);
    return sendUnhandledError();
  }
}
