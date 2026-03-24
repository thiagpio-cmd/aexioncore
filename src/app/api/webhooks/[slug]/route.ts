import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkRateLimit,
  generateDedupeKey,
  validatePayloadSize,
  sanitizePayload,
  webhookAccepted,
  webhookRejected,
  webhookRateLimited,
  webhookDuplicate,
} from "@/lib/integrations/webhook-security";
import { resolveEntity } from "@/lib/integrations/entity-resolution";
import { EVENT_TAXONOMY } from "@/lib/integrations/event-taxonomy";
import { providerRegistry } from "@/lib/integrations/provider-registry";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Webhook receiver endpoint — hardened.
 *
 * Security layers:
 * 1. Rate limiting per integration
 * 2. Payload size validation
 * 3. Signature validation (when provider supports it)
 * 4. Idempotency via deduplication key
 * 5. Entity resolution
 * 6. Canonical event creation
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;

  try {
    // ── 1. Rate Limiting ──────────────────────────────────────────────────
    const rateLimit = checkRateLimit(slug);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimit.resetAt - Date.now()) / 1000
            ).toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // ── 2. Find Integration ───────────────────────────────────────────────
    const integration = await prisma.integration.findUnique({
      where: { slug },
      include: {
        credentials: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Unknown integration" },
        { status: 404 }
      );
    }

    if (
      integration.status !== "connected" &&
      integration.status !== "CONNECTED"
    ) {
      return NextResponse.json(
        { success: false, error: "Integration is not connected" },
        { status: 400 }
      );
    }

    // ── 3. Read & Validate Payload Size ───────────────────────────────────
    const rawBody = await request.text();

    if (!validatePayloadSize(rawBody)) {
      return NextResponse.json(
        { success: false, error: "Payload too large" },
        { status: 413 }
      );
    }

    // ── 4. Signature Validation ───────────────────────────────────────────
    const provider = providerRegistry.get(slug);
    if (provider) {
      const signingSecret =
        integration.credentials?.[0]?.signingSecret || undefined;
      const headers: Record<string, string> = {};
      request.headers.forEach((v, k) => {
        headers[k] = v;
      });
      const validation = provider.validateWebhook(
        headers,
        rawBody,
        signingSecret ?? undefined
      );
      if (!validation.valid) {
        // Log the rejection
        await prisma.webhookEvent.create({
          data: {
            integrationId: integration.id,
            eventType: "WEBHOOK_REJECTED",
            status: "failed",
            payload: JSON.stringify(sanitizePayload({ reason: validation.error })),
            sourceIp:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              null,
            userAgent: request.headers.get("user-agent") || null,
          },
        });
        return NextResponse.json(
          { success: false, error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    // ── 5. Parse Payload ──────────────────────────────────────────────────
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Try form data or raw text
      payload = { raw: rawBody };
    }

    // ── 6. Determine Event Type ───────────────────────────────────────────
    const rawEventType =
      request.headers.get("x-event-type") ||
      payload.event ||
      payload.type ||
      "unknown";

    const eventType =
      typeof rawEventType === "string" ? rawEventType : "unknown";

    // ── 7. Deduplication ──────────────────────────────────────────────────
    const dedupeKey = generateDedupeKey(slug, eventType, payload);

    const existingEvent = await prisma.webhookEvent.findFirst({
      where: { dedupeKey, status: { in: ["received", "processed"] } },
    });

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        eventId: existingEvent.id,
        deduplicated: true,
      });
    }

    // ── 8. Store Webhook Event ────────────────────────────────────────────
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        integrationId: integration.id,
        eventType,
        status: "received",
        payload: JSON.stringify(sanitizePayload(payload)),
        dedupeKey,
        sourceIp:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // ── 9. Update Integration Stats ───────────────────────────────────────
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        eventsReceived: { increment: 1 },
        lastSync: new Date(),
      },
    });

    // ── 10. Process: Normalize → Resolve → Persist ────────────────────────
    try {
      await processWebhookEvent(
        integration,
        eventType,
        payload,
        webhookEvent.id,
        provider ?? null
      );

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "processed", processedAt: new Date() },
      });
    } catch (processingError: any) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "failed",
          processingError: processingError.message || "Processing failed",
          retryCount: { increment: 1 },
        },
      });

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          errorCount: { increment: 1 },
          consecutiveFailures: { increment: 1 },
        },
      });
    }

    return NextResponse.json({
      success: true,
      eventId: webhookEvent.id,
    });
  } catch (error: any) {
    console.error(`POST /api/webhooks/${slug} error:`, error);
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// ─── Processing Pipeline ────────────────────────────────────────────────────

async function processWebhookEvent(
  integration: {
    id: string;
    slug: string;
    organizationId: string;
  },
  eventType: string,
  payload: any,
  webhookEventId: string,
  provider: any | null
) {
  // ── A. Normalize via provider if available ───────────────────────────────
  let canonicalEvents: any[] = [];

  if (provider && typeof provider.normalizeWebhookPayload === "function") {
    canonicalEvents = provider.normalizeWebhookPayload(eventType, payload);
  }

  // ── B. Fallback to legacy processing if no provider ─────────────────────
  if (canonicalEvents.length === 0) {
    await legacyProcessWebhook(integration, eventType, payload);
    return;
  }

  // ── C. For each canonical event: resolve entities → persist ─────────────
  for (const event of canonicalEvents) {
    // Entity resolution
    const resolution = await resolveEntity({
      organizationId: integration.organizationId,
      email: event.counterpartyEmail,
      phone: event.counterpartyPhone,
      externalId: event.sourceExternalId,
    });

    // Create canonical revenue event
    await prisma.revenueEvent.create({
      data: {
        organizationId: integration.organizationId,
        provider: event.provider || integration.slug,
        domain: event.domain || "generic",
        eventType: event.eventType,
        direction: event.direction || "inbound",
        channel: event.channel || "WEBHOOK",
        occurredAt: event.occurredAt || new Date(),
        sourceExternalId: event.sourceExternalId || webhookEventId,
        threadExternalId: event.threadExternalId || null,
        actorExternalId: event.actorExternalId || null,
        counterpartyEmail: event.counterpartyEmail || null,
        counterpartyPhone: event.counterpartyPhone || null,
        resolvedContactId: resolution.contactId,
        resolvedCompanyId: resolution.companyId,
        resolvedAccountId: resolution.accountId,
        resolvedLeadId: resolution.leadId,
        resolvedOpportunityId: resolution.opportunityId,
        resolvedOwnerId: resolution.ownerId,
        resolutionMethod: resolution.method,
        resolutionConfidence: resolution.confidence,
        normalizedPayload: JSON.stringify(event.normalizedPayload || {}),
        rawPayloadRef: webhookEventId,
        dedupeKey: event.dedupeKey || `${integration.slug}:${webhookEventId}`,
        processingStatus: "processed",
      },
    });

    // Create side effects based on event taxonomy
    const taxonomy = EVENT_TAXONOMY[event.eventType];

    if (taxonomy?.createsInboxMessage) {
      await createInboxMessage(integration, event, resolution);
    }

    if (taxonomy?.createsActivity) {
      await createActivity(integration, event, resolution);
    }
  }

  // Reset consecutive failures on success
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      consecutiveFailures: 0,
      lastSuccessfulSync: new Date(),
    },
  });
}

// ─── Side Effect Creators ───────────────────────────────────────────────────

async function createInboxMessage(
  integration: { organizationId: string; slug: string },
  event: any,
  resolution: any
) {
  const channelMap: Record<string, string> = {
    EMAIL: "EMAIL",
    WHATSAPP: "WHATSAPP",
    SMS: "SMS",
    CALL: "CALL",
    SLACK: "INTERNAL",
    TEAMS: "INTERNAL",
  };

  await prisma.inboxMessage.create({
    data: {
      organizationId: integration.organizationId,
      channel: channelMap[event.channel] || "INTERNAL",
      sender: event.normalizedPayload?.from || event.counterpartyEmail || "Unknown",
      subject: event.normalizedPayload?.subject || null,
      body: event.normalizedPayload?.body || event.normalizedPayload?.text || "",
      isRead: false,
      contactId: resolution.contactId,
      companyId: resolution.companyId,
      leadId: resolution.leadId,
      opportunityId: resolution.opportunityId,
      ownerId: resolution.ownerId,
      sourceSystem: integration.slug,
      sourceExternalId: event.sourceExternalId,
      threadExternalId: event.threadExternalId,
      revenueEventId: null,
    },
  });
}

async function createActivity(
  integration: { organizationId: string; slug: string },
  event: any,
  resolution: any
) {
  // Only create activity if we resolved to a lead or opportunity
  if (!resolution.leadId && !resolution.opportunityId) return;
  if (!resolution.ownerId) return;

  const typeMap: Record<string, string> = {
    EMAIL: "EMAIL",
    WHATSAPP: "MESSAGE",
    SMS: "MESSAGE",
    CALL: "CALL",
    CALENDAR: "MEETING",
    CRM: "SYSTEM",
  };

  await prisma.activity.create({
    data: {
      organizationId: integration.organizationId,
      type: typeMap[event.channel] || "SYSTEM",
      channel: event.channel,
      leadId: resolution.leadId,
      opportunityId: resolution.opportunityId,
      subject: event.normalizedPayload?.subject || event.eventType,
      body:
        event.normalizedPayload?.body ||
        event.normalizedPayload?.text ||
        `${event.eventType} via ${integration.slug}`,
      creatorId: resolution.ownerId,
      revenueEventId: null,
    },
  });
}

// ─── Legacy Processing (backward compatibility) ─────────────────────────────

async function legacyProcessWebhook(
  integration: { id: string; slug: string; organizationId: string },
  eventType: string,
  payload: any
) {
  try {
    switch (integration.slug) {
      case "gmail":
      case "outlook": {
        if (
          eventType === "message.received" ||
          eventType === "email.received"
        ) {
          await prisma.inboxMessage.create({
            data: {
              organizationId: integration.organizationId,
              channel: "EMAIL",
              sender: payload.from || payload.sender || "Unknown",
              subject: payload.subject || "No Subject",
              body: payload.body || payload.snippet || "",
              isRead: false,
              sourceSystem: integration.slug,
            },
          });
        }
        break;
      }

      case "whatsapp": {
        if (
          eventType === "message.received" ||
          eventType === "messages"
        ) {
          await prisma.inboxMessage.create({
            data: {
              organizationId: integration.organizationId,
              channel: "WHATSAPP",
              sender:
                payload.from ||
                payload.contacts?.[0]?.profile?.name ||
                "Unknown",
              subject: null,
              body: payload.text?.body || payload.body || "",
              isRead: false,
              sourceSystem: integration.slug,
            },
          });
        }
        break;
      }

      case "slack": {
        if (eventType === "message" || eventType === "event_callback") {
          await prisma.inboxMessage.create({
            data: {
              organizationId: integration.organizationId,
              channel: "INTERNAL",
              sender:
                payload.user_name || payload.event?.user || "Slack",
              subject: payload.channel_name || null,
              body: payload.text || payload.event?.text || "",
              isRead: false,
              sourceSystem: integration.slug,
            },
          });
        }
        break;
      }

      default:
        console.log(
          `Unhandled webhook for ${integration.slug}:`,
          eventType
        );
        break;
    }
  } catch (error) {
    console.error(
      `Error in legacy webhook processing for ${integration.slug}:`,
      error
    );
    await prisma.integration.update({
      where: { id: integration.id },
      data: { errorCount: { increment: 1 } },
    });
  }
}
