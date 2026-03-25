import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { ensureProvidersInitialized } from "@/lib/integrations/init";

/**
 * POST /api/integrations/callback/twilio
 *
 * Webhook receiver for Twilio events (incoming calls and SMS).
 * Twilio sends POST requests with form-encoded data when calls/SMS arrive.
 * This route validates the webhook, normalizes the payload into canonical
 * events, and stores them as InboxMessage / Activity records.
 */
export async function POST(request: NextRequest) {
  ensureProvidersInitialized();

  try {
    const provider = providerRegistry.get("twilio");
    if (!provider) {
      console.error("[Twilio Webhook] Provider not registered");
      return NextResponse.json(
        { error: "Twilio provider not registered" },
        { status: 500 }
      );
    }

    // Read the raw body for signature validation
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Validate webhook signature
    const validation = provider.validateWebhook(
      headers,
      rawBody,
      process.env.TWILIO_AUTH_TOKEN
    );

    if (!validation.valid) {
      console.error("[Twilio Webhook] Signature validation failed:", validation.error);
      return NextResponse.json(
        { error: validation.error ?? "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse the form-encoded body
    const formData = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      payload[key] = value;
    }

    // Determine event type based on payload contents
    const callSid = payload.CallSid;
    const messageSid = payload.MessageSid ?? payload.SmsSid;
    let eventType = "unknown";
    if (messageSid && payload.Direction === "inbound") {
      eventType = "incoming_sms";
    } else if (messageSid) {
      eventType = "sms_status";
    } else if (callSid) {
      eventType = payload.Direction === "inbound" ? "incoming_call" : "call_status";
    }

    console.log(
      "[Twilio Webhook] Received event:",
      eventType,
      "CallSid:", callSid ?? "N/A",
      "MessageSid:", messageSid ?? "N/A"
    );

    // Normalize payload into canonical events
    const canonicalEvents = provider.normalizeWebhookPayload(eventType, payload);

    if (canonicalEvents.length === 0) {
      console.log("[Twilio Webhook] No canonical events produced");
      // Return TwiML empty response for Twilio
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Find the Twilio integration to associate events
    const integration = await prisma.integration.findFirst({
      where: { providerKey: "twilio", status: "CONNECTED" },
    });

    // Store events as webhook events for processing by the sync engine
    for (const event of canonicalEvents) {
      try {
        await prisma.webhookEvent.create({
          data: {
            integrationId: integration?.id ?? "unlinked",
            eventType: `twilio:${eventType}`,
            payload: { normalized: event.normalizedPayload, raw: payload } as any,
            processedAt: null,
          },
        });
      } catch (err) {
        console.error(
          "[Twilio Webhook] Failed to store event:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // Return TwiML empty response (acknowledges receipt)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error: unknown) {
    console.error(
      "POST /api/integrations/callback/twilio error:",
      error
    );
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
