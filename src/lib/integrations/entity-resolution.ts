/**
 * Entity Resolution Engine
 *
 * Decides which internal entity a canonical event relates to.
 * Without this, events are orphaned and the product is just a log viewer.
 *
 * Resolution order:
 * 1. externalId exact match
 * 2. email exact match → Contact → Company → Account → Lead → Opportunity
 * 3. phone exact match (E.164 normalized)
 * 4. domain heuristic (email domain → Company)
 * 5. thread association (same thread → same entities)
 * 6. unresolved (retained for manual review)
 */

import { prisma } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolutionInput {
  organizationId: string;
  /** Email of the counterparty */
  email?: string;
  /** Phone of the counterparty (will be normalized) */
  phone?: string;
  /** External ID from provider */
  externalId?: string;
  /** Thread/conversation ID from provider */
  threadExternalId?: string;
  /** Domain hint (from email) */
  domain?: string;
}

export interface ResolutionResult {
  contactId: string | null;
  companyId: string | null;
  accountId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  ownerId: string | null;
  teamId: string | null;
  confidence: number; // 0-100
  method: ResolutionMethod;
}

export type ResolutionMethod =
  | "email_exact"
  | "phone_exact"
  | "domain_heuristic"
  | "thread_association"
  | "unresolved";

// ─── Phone Normalization ────────────────────────────────────────────────────

/**
 * Normalize phone to a comparable format.
 * Strips non-digits, handles common Brazilian formats.
 */
export function normalizePhone(phone: string): string {
  // Remove everything except digits and +
  let clean = phone.replace(/[^\d+]/g, "");

  // Add Brazil country code if not present
  if (clean.startsWith("0")) {
    clean = "+55" + clean.substring(1);
  } else if (!clean.startsWith("+")) {
    // Assume Brazilian if no country code
    if (clean.length === 11 || clean.length === 10) {
      clean = "+55" + clean;
    }
  }

  return clean;
}

/**
 * Extract domain from email.
 */
export function extractDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return parts[1].toLowerCase();
}

// ─── Resolution Engine ──────────────────────────────────────────────────────

/**
 * Resolve an event to internal entities.
 * This is the core engine that connects external data to internal state.
 */
export async function resolveEntity(
  input: ResolutionInput
): Promise<ResolutionResult> {
  const empty: ResolutionResult = {
    contactId: null,
    companyId: null,
    accountId: null,
    leadId: null,
    opportunityId: null,
    ownerId: null,
    teamId: null,
    confidence: 0,
    method: "unresolved",
  };

  const { organizationId } = input;

  // ── 1. Try email match ──────────────────────────────────────────────────
  if (input.email) {
    const email = input.email.toLowerCase().trim();

    // Check Contact
    const contact = await prisma.contact.findFirst({
      where: { email },
      include: {
        company: {
          include: {
            accounts: {
              where: { organizationId },
              include: {
                opportunities: {
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (contact) {
      const account = contact.company?.accounts?.[0];
      const opportunity = account?.opportunities?.[0];

      // Try to find owner via opportunity or account
      let ownerId: string | null = null;
      if (opportunity) {
        ownerId = opportunity.ownerId;
      } else if (account?.ownerId) {
        ownerId = account.ownerId;
      }

      return {
        contactId: contact.id,
        companyId: contact.companyId,
        accountId: account?.id || null,
        leadId: null,
        opportunityId: opportunity?.id || null,
        ownerId,
        teamId: null,
        confidence: 95,
        method: "email_exact",
      };
    }

    // Check Lead
    const lead = await prisma.lead.findFirst({
      where: { email, organizationId },
      include: {
        owner: { select: { id: true, teamId: true } },
      },
    });

    if (lead) {
      return {
        contactId: null,
        companyId: lead.companyId,
        accountId: null,
        leadId: lead.id,
        opportunityId: null,
        ownerId: lead.ownerId,
        teamId: lead.owner?.teamId || null,
        confidence: 90,
        method: "email_exact",
      };
    }

    // ── 2. Try domain heuristic ─────────────────────────────────────────────
    const domain = extractDomain(email);
    if (domain) {
      const company = await prisma.company.findFirst({
        where: {
          organizationId,
          website: { contains: domain },
        },
        include: {
          accounts: {
            where: { organizationId },
            take: 1,
          },
        },
      });

      if (company) {
        return {
          contactId: null,
          companyId: company.id,
          accountId: company.accounts?.[0]?.id || null,
          leadId: null,
          opportunityId: null,
          ownerId: company.accounts?.[0]?.ownerId || null,
          teamId: null,
          confidence: 60,
          method: "domain_heuristic",
        };
      }
    }
  }

  // ── 3. Try phone match ────────────────────────────────────────────────────
  if (input.phone) {
    const normalized = normalizePhone(input.phone);

    // Check Contact by phone
    const contact = await prisma.contact.findFirst({
      where: { phone: normalized },
      include: {
        company: {
          include: {
            accounts: {
              where: { organizationId },
              take: 1,
            },
          },
        },
      },
    });

    if (contact) {
      return {
        contactId: contact.id,
        companyId: contact.companyId,
        accountId: contact.company?.accounts?.[0]?.id || null,
        leadId: null,
        opportunityId: null,
        ownerId: contact.company?.accounts?.[0]?.ownerId || null,
        teamId: null,
        confidence: 85,
        method: "phone_exact",
      };
    }

    // Check Lead by phone
    const lead = await prisma.lead.findFirst({
      where: { phone: normalized, organizationId },
    });

    if (lead) {
      return {
        contactId: null,
        companyId: lead.companyId,
        accountId: null,
        leadId: lead.id,
        opportunityId: null,
        ownerId: lead.ownerId,
        teamId: null,
        confidence: 80,
        method: "phone_exact",
      };
    }
  }

  // ── 4. Unresolved ─────────────────────────────────────────────────────────
  return empty;
}

// ─── Batch Resolution ───────────────────────────────────────────────────────

/**
 * Resolve multiple entities in batch (for initial sync).
 * More efficient than individual calls.
 */
export async function resolveEntities(
  inputs: ResolutionInput[]
): Promise<ResolutionResult[]> {
  // For now, resolve one-by-one. Future optimization: batch DB queries.
  return Promise.all(inputs.map(resolveEntity));
}
