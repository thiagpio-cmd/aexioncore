/**
 * Transcript Entity Resolver
 *
 * Resolves meeting transcript participants to CRM entities:
 * Contact → Account → Lead → Opportunity
 *
 * Priority: Opportunity (open, highest value) > Lead (active) > Account
 */

import { prisma } from "@/lib/db";

export interface TranscriptParticipant {
  name: string;
  email?: string;
  role?: string;
}

export interface ResolvedEntities {
  contactId: string | null;
  accountId: string | null;
  leadId: string | null;
  opportunityId: string | null;
}

/**
 * Resolve participants to CRM entities for a given organization.
 */
export async function resolveTranscriptEntities(
  participants: TranscriptParticipant[],
  organizationId: string,
  existingMeetingId?: string | null
): Promise<ResolvedEntities> {
  const result: ResolvedEntities = {
    contactId: null,
    accountId: null,
    leadId: null,
    opportunityId: null,
  };

  // If transcript has a meetingId, inherit links from the Meeting
  if (existingMeetingId) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: existingMeetingId },
      select: {
        contactId: true,
        leadId: true,
        opportunityId: true,
      },
    });
    if (meeting) {
      if (meeting.contactId) result.contactId = meeting.contactId;
      if (meeting.leadId) result.leadId = meeting.leadId;
      if (meeting.opportunityId) result.opportunityId = meeting.opportunityId;

      // If we already have an opportunity, resolve account from it
      if (result.opportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: result.opportunityId },
          select: { accountId: true },
        });
        if (opp) result.accountId = opp.accountId;
      }

      return result;
    }
  }

  // Resolve from participants
  for (const participant of participants) {
    if (result.opportunityId) break; // Already found best match

    let contact = null;

    // 1. Exact email match
    if (participant.email) {
      contact = await prisma.contact.findFirst({
        where: {
          email: { equals: participant.email, mode: "insensitive" },
          organizationId,
        },
        select: { id: true, companyId: true },
      });
    }

    // 2. Fuzzy name match (fallback)
    if (!contact && participant.name) {
      contact = await prisma.contact.findFirst({
        where: {
          name: { contains: participant.name, mode: "insensitive" },
          organizationId,
        },
        select: { id: true, companyId: true },
      });
    }

    if (!contact) continue;

    result.contactId = contact.id;

    // 3. Find Account via Company
    if (contact.companyId) {
      const account = await prisma.account.findFirst({
        where: { companyId: contact.companyId, organizationId },
        select: { id: true },
      });
      if (account) result.accountId = account.id;
    }

    // 4. Find active Opportunity (highest value, open stages)
    const openOpp = await prisma.opportunity.findFirst({
      where: {
        organizationId,
        primaryContactId: contact.id,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      orderBy: { value: "desc" },
      select: { id: true, accountId: true },
    });

    if (openOpp) {
      result.opportunityId = openOpp.id;
      if (!result.accountId && openOpp.accountId) {
        result.accountId = openOpp.accountId;
      }
      continue;
    }

    // 5. Find active Lead
    const activeLead = await prisma.lead.findFirst({
      where: {
        organizationId,
        contactId: contact.id,
        status: { notIn: ["CONVERTED", "DISQUALIFIED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (activeLead) {
      result.leadId = activeLead.id;
    }
  }

  return result;
}
