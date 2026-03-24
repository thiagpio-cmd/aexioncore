/**
 * Inbox Ingestion Service
 *
 * Receives CanonicalEvents from any integration provider and persists them
 * as InboxMessage rows. Handles deduplication, entity resolution, and
 * downstream canonical event emission.
 *
 * This is the critical bridge between the provider sync layer and the
 * application persistence layer. Without this, sync counts increment but
 * no data actually lands in the database.
 */

import { prisma } from "@/lib/db";
import type { CanonicalEvent } from "@/lib/integrations/provider-contract";

export interface IngestionContext {
  organizationId: string;
  integrationId: string;
  /** The user who owns this integration / whose mailbox this is */
  ownerId?: string;
}

export interface IngestionResult {
  created: number;
  skipped: number;   // deduped — already in DB
  failed: number;
  resolved: number;  // successfully linked to entity
  errors: string[];
}

/**
 * Classify a Gmail message into inbox status labels.
 */
function classifyGmailMessage(event: CanonicalEvent): {
  channel: string;
  direction: string;
  status: string;
} {
  const labels: string[] = event.normalizedPayload?.labelIds ?? [];
  const isInTrash  = labels.includes("TRASH");
  const isSpam     = labels.includes("SPAM");
  const isSent     = labels.includes("SENT") || event.direction === "outbound";

  return {
    channel:   event.channel ?? "EMAIL",
    direction: isSent ? "outbound" : "inbound",
    status:    (isInTrash || isSpam) ? "ARCHIVED" : "ACTIVE",
  };
}

/**
 * Extract email address from a "Name <email>" string.
 */
function extractEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  if (raw.includes("@")) return raw.trim().toLowerCase();
  return null;
}

/**
 * Extract domain from an email address.
 */
function extractDomain(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Deterministic entity resolution for an email address.
 * Returns linked IDs when a clear match exists. Never guesses.
 */
async function resolveEntities(
  senderEmail: string | null,
  organizationId: string
): Promise<{
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  resolved: boolean;
}> {
  const empty = { contactId: null, companyId: null, leadId: null, opportunityId: null, resolved: false };
  if (!senderEmail) return empty;

  // 1. Try Contact match (exact email)
  const contact = await prisma.contact.findUnique({
    where: { email: senderEmail },
    select: { id: true, companyId: true },
  });

  if (contact) {
    // Cascade: Contact → Lead (via contactId relationship)
    const lead = await prisma.lead.findFirst({
      where: { contactId: contact.id, organizationId },
      select: { id: true },
    });

    // Cascade: Contact → Company → Account → Opportunity
    const account = await prisma.account.findFirst({
      where: { companyId: contact.companyId, organizationId },
      select: { id: true },
    });

    let opportunityId: string | null = null;
    if (account) {
      const opp = await prisma.opportunity.findFirst({
        where: { accountId: account.id, organizationId, stage: { not: "CLOSED_LOST" } },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      opportunityId = opp?.id ?? null;
    }

    return {
      contactId: contact.id,
      companyId: contact.companyId,
      leadId: lead?.id ?? null,
      opportunityId,
      resolved: true,
    };
  }

  // 2. Try Lead match (exact email)
  const lead = await prisma.lead.findUnique({
    where: { email: senderEmail },
    select: { id: true, companyId: true },
  });

  if (lead) {
    return {
      contactId: null,
      companyId: lead.companyId,
      leadId: lead.id,
      opportunityId: null,
      resolved: true,
    };
  }

  // 3. Try Company match (domain heuristic)
  const domain = extractDomain(senderEmail);
  if (domain) {
    const company = await prisma.company.findFirst({
      where: {
        website: { contains: domain },
      },
      select: { id: true },
    });

    if (company) {
      return {
        contactId: null,
        companyId: company.id,
        leadId: null,
        opportunityId: null,
        resolved: true,
      };
    }
  }

  return empty;
}

/**
 * Ingest a batch of CanonicalEvents from any integration provider
 * into InboxMessage rows. Safe to call multiple times for the same event
 * (idempotent via sourceExternalId dedup).
 */
export async function ingestCanonicalEvents(
  events: CanonicalEvent[],
  ctx: IngestionContext
): Promise<IngestionResult> {
  const result: IngestionResult = { created: 0, skipped: 0, failed: 0, resolved: 0, errors: [] };

  if (!events || events.length === 0) return result;

  // Pull all known external IDs to enable bulk dedup check
  const externalIds = events
    .map((e) => e.sourceExternalId)
    .filter(Boolean);

  const existing = await prisma.inboxMessage.findMany({
    where: {
      organizationId: ctx.organizationId,
      sourceExternalId: { in: externalIds },
    },
    select: { sourceExternalId: true },
  });

  const existingIds = new Set(existing.map((m) => m.sourceExternalId));

  for (const event of events) {
    if (!event.sourceExternalId) {
      result.failed++;
      result.errors.push("Event missing sourceExternalId — skipped");
      continue;
    }

    if (existingIds.has(event.sourceExternalId)) {
      result.skipped++;
      continue;
    }

    try {
      const classification = classifyGmailMessage(event);
      const payload = event.normalizedPayload ?? {};
      const senderEmail = extractEmail(payload.from ?? event.actorExternalId);

      // Entity resolution — deterministic only
      const entities = await resolveEntities(senderEmail, ctx.organizationId);
      if (entities.resolved) result.resolved++;

      await prisma.inboxMessage.create({
        data: {
          organizationId:  ctx.organizationId,
          channel:         classification.channel,
          direction:       classification.direction,
          status:          classification.status,
          sender:          payload.from ?? event.actorExternalId ?? "unknown",
          subject:         payload.subject ?? null,
          body:            payload.snippet ?? "",
          isRead:          false,
          starred:         false,
          // Entity resolution
          contactId:       entities.contactId,
          companyId:       entities.companyId,
          leadId:          entities.leadId,
          opportunityId:   entities.opportunityId,
          // Source attribution
          sourceSystem:     event.provider,
          sourceExternalId: event.sourceExternalId,
          threadExternalId: event.threadExternalId ?? null,
          // Owner binding
          ownerId:         ctx.ownerId ?? null,
          createdAt:       event.occurredAt ?? new Date(),
        },
      });

      existingIds.add(event.sourceExternalId);
      result.created++;

      // Emit a canonical activity record so the timeline reflects this
      await prisma.activity.create({
        data: {
          type:           event.direction === "outbound" ? "EMAIL_SENT" : "EMAIL_RECEIVED",
          subject:        payload.subject ?? "(no subject)",
          body:           payload.snippet ?? "",
          channel:        "EMAIL",
          direction:      event.direction === "outbound" ? "outbound" : "inbound",
          sourceSystem:   event.provider,
          externalId:     event.sourceExternalId,
          occurredAt:     event.occurredAt ?? new Date(),
          organizationId: ctx.organizationId,
          leadId:         entities.leadId,
          opportunityId:  entities.opportunityId,
          creatorId:      ctx.ownerId ?? undefined,
        },
      }).catch(() => {
        // Activity is best-effort; InboxMessage is the critical write
      });

    } catch (err) {
      result.failed++;
      result.errors.push(
        `Failed to persist ${event.sourceExternalId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(JSON.stringify({
    event: "ingestion.completed",
    organizationId: ctx.organizationId,
    integrationId: ctx.integrationId,
    created: result.created,
    skipped: result.skipped,
    failed: result.failed,
    resolved: result.resolved,
    total: events.length,
    timestamp: new Date().toISOString(),
  }));

  return result;
}

/**
 * Re-link existing InboxMessages by running entity resolution again.
 * Useful after adding new CRM contacts/leads to retroactively link messages.
 */
export async function relinkMessages(
  organizationId: string
): Promise<{ updated: number; alreadyLinked: number; unresolved: number }> {
  const messages = await prisma.inboxMessage.findMany({
    where: { organizationId, sourceSystem: "gmail" },
    select: { id: true, sender: true, contactId: true, leadId: true, sourceExternalId: true },
  });

  let updated = 0;
  let alreadyLinked = 0;
  let unresolved = 0;

  for (const msg of messages) {
    const senderEmail = extractEmail(msg.sender);
    const entities = await resolveEntities(senderEmail, organizationId);

    if (!entities.resolved) {
      unresolved++;
      continue;
    }

    // Skip if already correctly linked
    if (msg.contactId === entities.contactId && msg.leadId === entities.leadId) {
      alreadyLinked++;
      continue;
    }

    // Update InboxMessage with resolved entities
    await prisma.inboxMessage.update({
      where: { id: msg.id },
      data: {
        contactId: entities.contactId,
        companyId: entities.companyId,
        leadId: entities.leadId,
        opportunityId: entities.opportunityId,
      },
    });

    // Also update matching Activity record (Activity.externalId = Gmail message ID)
    await prisma.activity.updateMany({
      where: {
        organizationId,
        externalId: msg.sourceExternalId ?? undefined,
        sourceSystem: "gmail",
      },
      data: {
        leadId: entities.leadId,
        opportunityId: entities.opportunityId,
      },
    }).catch(() => {});

    updated++;
  }

  console.log(JSON.stringify({
    event: "relink.completed",
    organizationId,
    updated,
    alreadyLinked,
    unresolved,
    total: messages.length,
  }));

  return { updated, alreadyLinked, unresolved };
}
