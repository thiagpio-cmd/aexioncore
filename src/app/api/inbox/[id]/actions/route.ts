import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

type InboxAction =
  | { action: "create_task"; title: string; dueDate?: string; priority?: string }
  | { action: "create_lead"; name: string; email?: string; phone?: string; company?: string; source?: string; notes?: string }
  | { action: "link_contact"; contactId: string }
  | { action: "link_opportunity"; opportunityId: string }
  | { action: "mark_read" }
  | { action: "mark_unread" }
  | { action: "archive" }
  | { action: "reply"; body: string; channel: string }
  | { action: "log_activity"; type: string; notes: string }
  | { action: "snooze"; until: string };

const InboxActionSchema = z.union([
  z.object({
    action: z.literal("create_task"),
    title: z.string(),
    dueDate: z.string().optional(),
    priority: z.string().optional(),
  }),
  z.object({
    action: z.literal("create_lead"),
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("link_contact"),
    contactId: z.string(),
  }),
  z.object({
    action: z.literal("link_opportunity"),
    opportunityId: z.string(),
  }),
  z.object({
    action: z.literal("mark_read"),
  }),
  z.object({
    action: z.literal("mark_unread"),
  }),
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("reply"),
    body: z.string(),
    channel: z.string(),
  }),
  z.object({
    action: z.literal("log_activity"),
    type: z.string(),
    notes: z.string(),
  }),
  z.object({
    action: z.literal("snooze"),
    until: z.string(),
  }),
]);

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = rateLimit(`inbox_action_${ip}`, 10, 60000); // 10 per minute
    if (!success) {
      logger.warn({ event: "RATE_LIMIT_EXCEEDED", route: "/api/inbox/[id]/actions", ip });
      return sendError(badRequest("Too many requests"));
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn({ event: "AUTH_FAILURE", route: "/api/inbox/[id]/actions", ip });
      return sendError(unauthorized());
    }

    const { id } = await ctx.params;
    const message = await prisma.inboxMessage.findUnique({ where: { id } });

    if (!message) return sendError(notFound("Message"));
    if (message.organizationId !== session.user.organizationId) {
      return sendError(notFound("Message"));
    }

    const body: InboxAction = await request.json();

    const result = InboxActionSchema.safeParse(body);

    if (!result.success) {
      logger.warn({ event: "INBOX_ACTION_VALIDATION_FAILURE", error: result.error, messageId: id });
      return sendError(badRequest("Invalid action data", result.error));
    }

    const userId = session.user.id;
    const orgId = session.user.organizationId;

    switch (body.action) {
      // ── Create Task ──────────────────────────────────────────────────
      case "create_task": {
        if (!body.title?.trim()) {
          return sendError(badRequest("Task title is required"));
        }

        const task = await prisma.task.create({
          data: {
            title: body.title.trim(),
            description: `Created from inbox message: ${message.subject || message.sender}`,
            type: "FOLLOW_UP",
            priority: body.priority || "MEDIUM",
            status: "PENDING",
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            leadId: message.leadId || undefined,
            opportunityId: message.opportunityId || undefined,
            ownerId: userId,
            organizationId: orgId,
          },
        });

        await prisma.activity.create({
          data: {
            type: "task.created",
            subject: `Task created from inbox: ${body.title}`,
            body: `Task "${body.title}" created from message by ${message.sender}`,
            leadId: message.leadId || undefined,
            opportunityId: message.opportunityId || undefined,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        return sendSuccess({ message: updated, task }, 201);
      }

      // ── Create Lead ──────────────────────────────────────────────────
      case "create_lead": {
        if (!body.name?.trim()) {
          return sendError(badRequest("Lead name is required"));
        }

        // Find or create a default company
        let companyId: string;
        const companyName = body.company?.trim() || "Unknown Company";
        const existingCompany = await prisma.company.findFirst({
          where: { name: companyName, organizationId: orgId },
        });

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const newCompany = await prisma.company.create({
            data: {
              name: companyName,
              organizationId: orgId,
            },
          });
          companyId = newCompany.id;
        }

        const leadEmail = body.email?.trim() || `${body.name.trim().toLowerCase().replace(/\s+/g, ".")}@placeholder.com`;

        const lead = await prisma.lead.create({
          data: {
            name: body.name.trim(),
            email: leadEmail,
            phone: body.phone || null,
            source: body.source || "inbox",
            status: "NEW",
            temperature: "WARM",
            organizationId: orgId,
            companyId,
            ownerId: userId,
          },
        });

        // Link message to the new lead
        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { leadId: lead.id },
        });

        await prisma.activity.create({
          data: {
            type: "lead.created",
            subject: `Lead created from inbox: ${body.name}`,
            body: `Lead "${body.name}" created from message by ${message.sender}`,
            leadId: lead.id,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        return sendSuccess({ message: updated, lead }, 201);
      }

      // ── Link Contact ─────────────────────────────────────────────────
      case "link_contact": {
        if (!body.contactId?.trim()) {
          return sendError(badRequest("Contact ID is required"));
        }

        const contact = await prisma.contact.findUnique({
          where: { id: body.contactId },
        });
        if (!contact) return sendError(notFound("Contact"));

        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { contactId: body.contactId, companyId: contact.companyId },
        });

        await prisma.activity.create({
          data: {
            type: "contact.linked",
            subject: `Contact linked to inbox message`,
            body: `Contact "${contact.name}" linked to message from ${message.sender}`,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        return sendSuccess({ message: updated });
      }

      // ── Link Opportunity ──────────────────────────────────────────────
      case "link_opportunity": {
        if (!body.opportunityId?.trim()) {
          return sendError(badRequest("Opportunity ID is required"));
        }

        const opportunity = await prisma.opportunity.findUnique({
          where: { id: body.opportunityId },
        });
        if (!opportunity) return sendError(notFound("Opportunity"));
        if (opportunity.organizationId !== orgId) {
          return sendError(notFound("Opportunity"));
        }

        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { opportunityId: body.opportunityId },
        });

        await prisma.activity.create({
          data: {
            type: "opportunity.linked",
            subject: `Opportunity linked to inbox message`,
            body: `Opportunity "${opportunity.title}" linked to message from ${message.sender}`,
            opportunityId: body.opportunityId,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        return sendSuccess({ message: updated });
      }

      // ── Mark Read ─────────────────────────────────────────────────────
      case "mark_read": {
        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { isRead: true },
        });
        return sendSuccess({ message: updated });
      }

      // ── Mark Unread ───────────────────────────────────────────────────
      case "mark_unread": {
        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { isRead: false },
        });
        return sendSuccess({ message: updated });
      }

      // ── Archive ───────────────────────────────────────────────────────
      case "archive": {
        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { status: "ARCHIVED", isRead: true },
        });

        await prisma.activity.create({
          data: {
            type: "message.archived",
            subject: `Inbox message archived`,
            body: `Message from ${message.sender} archived`,
            leadId: message.leadId || undefined,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        return sendSuccess({ message: updated });
      }

      // ── Reply ─────────────────────────────────────────────────────────
      case "reply": {
        if (!body.body?.trim()) {
          return sendError(badRequest("Reply body is required"));
        }

        const replyMessage = await prisma.inboxMessage.create({
          data: {
            channel: body.channel || message.channel,
            sender: session.user.name || session.user.email || "You",
            subject: message.subject ? `Re: ${message.subject}` : null,
            body: body.body.trim(),
            direction: "outbound",
            isRead: true,
            status: "ACTIVE",
            organizationId: orgId,
            contactId: message.contactId,
            companyId: message.companyId,
            leadId: message.leadId,
            opportunityId: message.opportunityId,
            ownerId: userId,
          },
        });

        await prisma.activity.create({
          data: {
            type: "message.reply_sent",
            channel: body.channel || message.channel,
            subject: message.subject ? `Re: ${message.subject}` : "Reply sent",
            body: body.body.trim(),
            leadId: message.leadId || undefined,
            opportunityId: message.opportunityId || undefined,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        // Fire-and-forget AI processing for the new reply message
        console.log(`[AI Trigger] Triggering AI processing for reply inbox message ${replyMessage.id}`);
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai/process-activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inboxMessageId: replyMessage.id }),
        }).catch(() => {});

        // Mark original as read
        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { isRead: true },
        });

        return sendSuccess({ message: updated, reply: replyMessage }, 201);
      }

      // ── Log Activity ──────────────────────────────────────────────────
      case "log_activity": {
        if (!body.type?.trim()) {
          return sendError(badRequest("Activity type is required"));
        }

        const activity = await prisma.activity.create({
          data: {
            type: body.type.toUpperCase(),
            subject: `${body.type} logged from inbox message`,
            body: body.notes || "",
            channel: message.channel,
            leadId: message.leadId || undefined,
            opportunityId: message.opportunityId || undefined,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        // Fire-and-forget AI processing for the logged activity
        console.log(`[AI Trigger] Triggering AI processing for logged activity ${activity.id}`);
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai/process-activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId: activity.id }),
        }).catch(() => {});

        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        return sendSuccess({ message: updated, activity }, 201);
      }

      // ── Snooze ────────────────────────────────────────────────────────
      case "snooze": {
        if (!body.until) {
          return sendError(badRequest("Snooze time is required"));
        }

        const snoozeUntil = new Date(body.until);
        if (isNaN(snoozeUntil.getTime())) {
          return sendError(badRequest("Invalid snooze time"));
        }

        const updated = await prisma.inboxMessage.update({
          where: { id },
          data: { snoozeUntil, status: "SNOOZED", isRead: true },
        });

        await prisma.activity.create({
          data: {
            type: "message.snoozed",
            subject: `Inbox message snoozed`,
            body: `Message from ${message.sender} snoozed until ${snoozeUntil.toLocaleString()}`,
            leadId: message.leadId || undefined,
            creatorId: userId,
            organizationId: orgId,
          },
        });

        return sendSuccess({ message: updated });
      }

      default:
        return sendError(badRequest(`Unknown action: ${(body as any).action}`));
    }
  } catch (error: any) {
    logger.error({ 
      event: "INBOX_ACTION_FAILURE", 
      error, 
      route: "/api/inbox/[id]/actions" 
    });
    return sendUnhandledError();
  }
}
