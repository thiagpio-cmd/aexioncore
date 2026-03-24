import { prisma } from "@/lib/db";
import { auditUpdate } from "@/server/audit";

export async function classifyInboxMessage(
  messageId: string,
  organizationId: string,
  actorId: string,
  payload: { category: string; relevance: string }
) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId } });
  if (!message || message.organizationId !== organizationId) {
    throw new Error("Message not found or access denied");
  }

  const updated = await prisma.inboxMessage.update({
    where: { id: messageId },
    data: {
      category: payload.category,
      relevance: payload.relevance,
    },
  });

  await prisma.activity.create({
    data: {
      type: "message.classified",
      channel: message.channel.toLowerCase(),
      subject: `Message classified as ${payload.category}`,
      body: `Relevance: ${payload.relevance}`,
      creatorId: actorId,
      organizationId,
      leadId: message.leadId,
      opportunityId: message.opportunityId,
    },
  });

  return updated;
}

export async function linkInboxMessage(
  messageId: string,
  organizationId: string,
  actorId: string,
  payload: { entityType: "lead" | "opportunity"; entityId: string }
) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId } });
  if (!message || message.organizationId !== organizationId) {
    throw new Error("Message not found or access denied");
  }

  const dataToUpdate: any = {};
  if (payload.entityType === "lead") {
    dataToUpdate.leadId = payload.entityId;
    // Up-propagate continuity fields
    const lead = await prisma.lead.findUnique({ where: { id: payload.entityId }, select: { companyId: true, contactId: true } });
    if (lead) {
      dataToUpdate.companyId = lead.companyId;
      if (lead.contactId) dataToUpdate.contactId = lead.contactId;
    }
  } else if (payload.entityType === "opportunity") {
    dataToUpdate.opportunityId = payload.entityId;
    // Up-propagate continuity fields
    const opp = await prisma.opportunity.findUnique({ where: { id: payload.entityId }, select: { accountId: true, primaryContactId: true, account: { select: { companyId: true } } } });
    if (opp) {
      dataToUpdate.companyId = opp.account?.companyId;
      if (opp.primaryContactId) dataToUpdate.contactId = opp.primaryContactId;
    }
  }

  const updated = await prisma.inboxMessage.update({
    where: { id: messageId },
    data: dataToUpdate,
  });

  await prisma.activity.create({
    data: {
      type: "message.linked",
      channel: message.channel.toLowerCase(),
      subject: `Message linked to ${payload.entityType}`,
      creatorId: actorId,
      organizationId,
      ...(payload.entityType === "lead" ? { leadId: payload.entityId } : { opportunityId: payload.entityId }),
    },
  });

  return updated;
}

export async function createInboxAction(
  messageId: string,
  organizationId: string,
  actorId: string,
  payload: { actionType: string; title: string; description?: string; dueDate?: string; assignedTo?: string }
) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId } });
  if (!message || message.organizationId !== organizationId) {
    throw new Error("Message not found or access denied");
  }

  return prisma.$transaction(async (tx) => {
    // Determine entity link
    const leadId = message.leadId;
    const opportunityId = message.opportunityId;

    // 1. Create the task
    const task = await tx.task.create({
      data: {
        title: payload.title,
        description: payload.description || `Task created from message: ${message.subject}`,
        type: payload.actionType || "FOLLOW_UP",
        priority: "MEDIUM",
        status: "PENDING",
        ownerId: payload.assignedTo || actorId,
        organizationId,
        leadId,
        opportunityId,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      },
    });

    // 2. Emit MESSAGE_ACTION_CREATED
    await tx.activity.create({
      data: {
        type: "message.action_created",
        channel: message.channel.toLowerCase(),
        subject: `Action generated from message`,
        body: `Created task: ${task.title}`,
        creatorId: actorId,
        organizationId,
        leadId,
        opportunityId,
      },
    });

    // TASK_CREATED is implicitly handled by timeline-engine parsing tasks directly,
    // but we might want to ensure activity exists if the frontend expects it there.
    // TimelineEngine maps tasks dynamically into "TASK_CREATED".

    return task;
  });
}
