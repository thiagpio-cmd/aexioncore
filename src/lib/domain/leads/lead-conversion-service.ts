import { prisma } from "@/lib/db";
import { auditCreate, auditStageChange } from "@/server/audit";

export interface ConvertLeadParams {
  leadId: string;
  organizationId: string;
  actorId: string;
  opportunityTitle: string;
  opportunityValue: number;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  description?: string;
}

export async function convertLeadToOpportunity(params: ConvertLeadParams) {
  const {
    leadId,
    organizationId,
    actorId,
    opportunityTitle,
    opportunityValue,
    stage,
    probability,
    expectedCloseDate,
    description,
  } = params;

  return prisma.$transaction(async (tx) => {
    // 1. Fetch Lead with owner for ownerName propagation
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { company: true, owner: { select: { id: true, name: true } } },
    });

    if (!lead || lead.organizationId !== organizationId) {
      throw new Error("Lead not found or access denied");
    }

    if (lead.status === "CONVERTED" || lead.status === "DISQUALIFIED") {
      throw new Error(`Cannot convert a lead with status ${lead.status}`);
    }

    // 2. Find or create Account linked to company
    let account = await tx.account.findFirst({
      where: {
        companyId: lead.companyId,
        organizationId,
      },
    });

    if (!account) {
      account = await tx.account.create({
        data: {
          name: lead.company.name,
          companyId: lead.companyId,
          organizationId,
          ownerId: lead.ownerId,
          status: "active",
        },
      });
      auditCreate(organizationId, actorId, "Account", account.id, {
        name: account.name,
        source: "lead_conversion",
      });
    }

    // 3. Resolve stageId from pipeline for field continuity
    let resolvedStageId: string | undefined;
    const pipeline = await tx.pipeline.findFirst({
      where: { organizationId },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    if (pipeline) {
      const matchingStage = pipeline.stages.find(
        (s) => s.name.toUpperCase() === stage.toUpperCase()
      );
      resolvedStageId = matchingStage?.id ?? pipeline.stages[0]?.id;
    }

    // 4. Create Opportunity with full field continuity
    const opportunity = await tx.opportunity.create({
      data: {
        title: opportunityTitle,
        description,
        value: opportunityValue,
        stage,
        stageId: resolvedStageId,
        probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
        accountId: account.id,
        ownerId: lead.ownerId,
        ownerName: lead.owner.name,
        primaryContactId: lead.contactId ?? undefined,
        organizationId,
        sourceSystem: lead.sourceSystem,
        sourceExternalId: lead.sourceExternalId,
      },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    });

    auditCreate(organizationId, actorId, "Opportunity", opportunity.id, {
      title: opportunity.title,
      value: opportunity.value,
      source: "lead_conversion",
      leadId,
    });

    // 5. Update Lead status
    const oldStatus = lead.status;
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: { status: "CONVERTED" },
    });

    auditStageChange(organizationId, actorId, "Lead", leadId, oldStatus, "CONVERTED");

    // 6. Emit Canonical Events
    await tx.activity.createMany({
      data: [
        {
          type: "lead.converted",
          channel: "system",
          leadId,
          opportunityId: opportunity.id,
          subject: `Lead converted to opportunity`,
          body: `Lead "${lead.name}" was converted to opportunity "${opportunityTitle}"`,
          organizationId,
          creatorId: actorId,
        },
        {
          type: "opportunity.created",
          channel: "system",
          opportunityId: opportunity.id,
          leadId,
          subject: `Opportunity created via conversion`,
          body: `Created from lead "${lead.name}"`,
          organizationId,
          creatorId: actorId,
        },
      ],
    });

    // 6.5. Reparent associated records to preserve continuity
    await tx.task.updateMany({
      where: { leadId },
      data: { opportunityId: opportunity.id, leadId: null },
    });
    await tx.meeting.updateMany({
      where: { leadId },
      data: { opportunityId: opportunity.id, leadId: null },
    });
    await tx.activity.updateMany({
      where: { leadId },
      data: { opportunityId: opportunity.id, leadId: null },
    });
    await tx.insight.updateMany({
      where: { leadId },
      data: { opportunityId: opportunity.id, leadId: null },
    });
    await tx.inboxMessage.updateMany({
      where: { leadId },
      data: { opportunityId: opportunity.id, leadId: null },
    });

    // 7. Auto-generate follow-up task
    await tx.task.create({
      data: {
        title: `Follow up on new deal: ${opportunityTitle}`,
        description: "Task auto-generated from lead conversion",
        type: "FOLLOW_UP",
        priority: "HIGH",
        status: "PENDING",
        opportunityId: opportunity.id,
        ownerId: lead.ownerId,
        organizationId,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      }
    });

    return {
      opportunity,
      account,
      lead: updatedLead,
    };
  });
}
