import { prisma } from "@/lib/db";
import { auditStageChange } from "@/server/audit";
import { OPP_STAGE_TRANSITIONS, STAGE_DEFAULT_PROBABILITY, type OppStage } from "@/lib/domain/enums";

export interface StageTransitionParams {
  opportunityId: string;
  organizationId: string;
  actorId: string;
  targetStage: string;
  note?: string;
  nextStepTask?: {
    title: string;
    dueDate?: string;
  };
}

export async function transitionOpportunityStage(params: StageTransitionParams) {
  const { opportunityId, organizationId, actorId, targetStage, note, nextStepTask } = params;

  return prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.findUnique({ where: { id: opportunityId } });
    
    if (!opp || opp.organizationId !== organizationId) {
      throw new Error("Opportunity not found or access denied");
    }

    if (opp.stage === targetStage) {
      throw new Error("Opportunity is already in the target stage");
    }

    const oldStage = opp.stage as OppStage;

    // Validate stage transition is allowed
    const allowedTargets = OPP_STAGE_TRANSITIONS[oldStage];
    if (allowedTargets && !allowedTargets.includes(targetStage as OppStage)) {
      throw new Error(`Invalid transition: ${oldStage} → ${targetStage}. Allowed: ${allowedTargets.join(", ")}`);
    }

    // Auto-adjust probability based on stage defaults
    const newProbability = STAGE_DEFAULT_PROBABILITY[targetStage as OppStage] ?? opp.probability;

    const updated = await tx.opportunity.update({
      where: { id: opportunityId },
      data: { 
        stage: targetStage,
        probability: newProbability,
      },
    });

    // 2. Audit
    auditStageChange(organizationId, actorId, "Opportunity", opportunityId, oldStage, targetStage);

    // 3. Emit Canonical Event (via Activity)
    await tx.activity.create({
      data: {
        type: "opportunity.stage_changed",
        channel: "system",
        opportunityId: opportunityId,
        subject: `Stage advanced: ${oldStage} → ${targetStage}`,
        body: `Transition triggered${note ? ` with note: ${note}` : ""}`,
        organizationId,
        creatorId: actorId,
      },
    });

    // 4. Optionally create next step task
    let createdTask = null;
    if (nextStepTask?.title) {
      createdTask = await tx.task.create({
        data: {
          title: nextStepTask.title,
          type: "FOLLOW_UP",
          priority: "HIGH",
          status: "PENDING",
          opportunityId,
          ownerId: opp.ownerId, // keep owner
          organizationId,
          dueDate: nextStepTask.dueDate ? new Date(nextStepTask.dueDate) : undefined,
        },
      });
      // Emit task created
      await tx.activity.create({
        data: {
          type: "task.created",
          channel: "system",
          opportunityId: opportunityId,
          subject: `Next-step task created`,
          body: `Task: ${createdTask.title}`,
          organizationId,
          creatorId: actorId,
        },
      });
    }

    return { opportunity: updated, task: createdTask };
  });
}
