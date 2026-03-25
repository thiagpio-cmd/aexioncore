import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { badRequest, notFound } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { processActivity, type ActivityInput } from "@/lib/ai/activity-processor";
import { executeActions } from "@/lib/ai/action-executor";
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limiter";

/**
 * POST /api/ai/process-activity
 *
 * Processes a single Activity or InboxMessage through the AI engine.
 * Classifies intent, extracts entities, analyzes sentiment, and executes CRM actions.
 *
 * Body: { activityId: string } or { inboxMessageId: string }
 *
 * Called:
 * - Automatically (fire-and-forget) after activity/inbox message creation
 * - Manually from UI ("Analyze with AI" button)
 *
 * Auth: Supports both session-based auth (UI calls) and internal fire-and-forget
 * calls (no session). Internal calls look up org/user from the entity itself.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Rate limiting — apply to authenticated (UI) calls; internal fire-and-forget calls skip
    if (session?.user) {
      const rateKey = `ai:${(session.user as any).id}`;
      const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.ai);
      if (!rateCheck.allowed) return rateLimitResponse(rateCheck);
    }

    const body = await request.json();
    const { activityId, inboxMessageId } = body;

    if (!activityId && !inboxMessageId) {
      return sendError(badRequest("Either activityId or inboxMessageId is required"));
    }

    // For authenticated requests, use session context.
    // For internal fire-and-forget calls (no session), derive context from the entity.
    let organizationId = session?.user?.organizationId;
    let userId = session?.user?.id;

    let input: ActivityInput;

    // ─── Load Activity ──────────────────────────────────────────────────

    if (activityId) {
      const whereClause: any = { id: activityId };
      if (organizationId) whereClause.organizationId = organizationId;

      const activity = await prisma.activity.findFirst({
        where: whereClause,
      });

      if (!activity) return sendError(notFound("Activity"));

      // Derive context from entity for internal calls
      if (!organizationId) organizationId = activity.organizationId ?? undefined;
      if (!userId) userId = activity.creatorId ?? undefined;

      // Skip if this activity is itself an AI_SUMMARY (avoid infinite loops)
      if (activity.type === "AI_SUMMARY") {
        return sendSuccess({ skipped: true, reason: "Already an AI_SUMMARY activity" });
      }

      // Check if an AI_SUMMARY already exists for this activity
      const existingSummary = await prisma.activity.findFirst({
        where: {
          type: "AI_SUMMARY",
          subject: { contains: activityId },
          organizationId: activity.organizationId,
        },
      });

      if (existingSummary) {
        console.log(`[AI ProcessActivity] AI_SUMMARY already exists for activity ${activityId}, skipping`);
        return sendSuccess({ skipped: true, reason: "Already processed" });
      }

      // Load related lead and opportunity if linked
      let lead = null;
      let opportunity = null;

      if (activity.leadId) {
        lead = await prisma.lead.findUnique({
          where: { id: activity.leadId },
          select: { id: true, name: true, status: true, temperature: true },
        });
      }

      if (activity.opportunityId) {
        opportunity = await prisma.opportunity.findUnique({
          where: { id: activity.opportunityId },
          select: { id: true, title: true, stage: true, value: true },
        });
      }

      input = {
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        body: activity.body,
        channel: activity.channel,
        direction: activity.direction,
        leadId: activity.leadId,
        opportunityId: activity.opportunityId,
        lead,
        opportunity,
      };
    }

    // ─── Load InboxMessage ──────────────────────────────────────────────

    else {
      const whereClause: any = { id: inboxMessageId };
      if (organizationId) whereClause.organizationId = organizationId;

      const message = await prisma.inboxMessage.findFirst({
        where: whereClause,
      });

      if (!message) return sendError(notFound("InboxMessage"));

      // Derive context from entity for internal calls
      if (!organizationId) organizationId = message.organizationId ?? undefined;
      if (!userId) userId = message.ownerId ?? undefined;

      // Check if an AI_SUMMARY already exists for this inbox message
      const existingSummary = await prisma.activity.findFirst({
        where: {
          type: "AI_SUMMARY",
          subject: { contains: inboxMessageId! },
          organizationId: message.organizationId,
        },
      });

      if (existingSummary) {
        console.log(`[AI ProcessActivity] AI_SUMMARY already exists for inbox message ${inboxMessageId}, skipping`);
        return sendSuccess({ skipped: true, reason: "Already processed" });
      }

      // Load related lead and opportunity if linked
      let lead = null;
      let opportunity = null;

      if (message.leadId) {
        lead = await prisma.lead.findUnique({
          where: { id: message.leadId },
          select: { id: true, name: true, status: true, temperature: true },
        });
      }

      if (message.opportunityId) {
        opportunity = await prisma.opportunity.findUnique({
          where: { id: message.opportunityId },
          select: { id: true, title: true, stage: true, value: true },
        });
      }

      input = {
        id: message.id,
        type: message.channel,
        subject: message.subject,
        body: message.body,
        channel: message.channel,
        direction: message.direction,
        leadId: message.leadId,
        opportunityId: message.opportunityId,
        lead,
        opportunity,
      };
    }

    // ─── Process ────────────────────────────────────────────────────────

    const processingResult = await processActivity(input);

    // ─── Execute Actions ────────────────────────────────────────────────

    // Bail out if we couldn't resolve context (should not happen in practice)
    if (!organizationId || !userId) {
      return sendSuccess({
        processing: processingResult,
        execution: { total: 0, executed: 0, skipped: 0, failed: 0, details: [] },
        warning: "Could not resolve organizationId or userId — actions skipped",
      });
    }

    const executionResults = await executeActions(processingResult.actions, {
      organizationId,
      userId,
    });

    // ─── Persist AI_SUMMARY ─────────────────────────────────────────────

    const sourceId = activityId || inboxMessageId;
    const sourceLabel = activityId ? sourceId : `inbox:${sourceId}`;

    await prisma.activity.create({
      data: {
        type: "AI_SUMMARY",
        subject: `AI Analysis [${sourceLabel}]`,
        body: JSON.stringify({
          sourceActivityId: activityId || undefined,
          sourceInboxMessageId: inboxMessageId || undefined,
          classification: processingResult.classification,
          sentiment: processingResult.sentiment,
          entities: processingResult.entities,
          actions: processingResult.actions,
          summary: processingResult.summary,
          provider: processingResult.provider,
        }),
        channel: "ai",
        leadId: input.leadId,
        opportunityId: input.opportunityId,
        organizationId: organizationId ?? null,
        creatorId: userId ?? null,
      },
    }).catch((err) => {
      console.warn("[AI ProcessActivity] Failed to persist AI_SUMMARY:", err);
    });

    console.log(`[AI ProcessActivity] Processed ${sourceLabel} via ${processingResult.provider} | intent=${processingResult.classification.intent} | actions=${processingResult.actions.length}`);

    // ─── Return Result ──────────────────────────────────────────────────

    return sendSuccess({
      processing: processingResult,
      execution: {
        total: executionResults.length,
        executed: executionResults.filter((r) => r.status === "executed").length,
        skipped: executionResults.filter((r) => r.status === "skipped").length,
        failed: executionResults.filter((r) => r.status === "failed").length,
        details: executionResults.map((r) => ({
          type: r.action.type,
          status: r.status,
          reason: r.reason,
          entityId: r.entityId,
        })),
      },
    });
  } catch (error: any) {
    console.error("POST /api/ai/process-activity error:", error);
    return sendUnhandledError();
  }
}
