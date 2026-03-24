import { prisma } from "@/lib/db";
import { auditStageChange } from "@/server/audit";

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

    const oldStage = opp.stage;

    // Optional constraint: if moving to a non-terminal phase and risk supports it, require next step
    if (!["CLOSED_WON", "CLOSED_LOST"].includes(targetStage) && !["CLOSED_WON", "CLOSED_LOST"].includes(oldStage)) {
      // For MVP, we'll accept it but maybe log an insight if no next step is given.
      // But let's follow the strict "exception if nextStep missing" for "in-flight" deals
      // if it's explicitly required by business rules. Here we enforce it optionally if the frontend sends it,
      // or we can strictly enforce it:
      // if (!nextStepTask) throw new Error("A next step task is required when advancing stages");
    }

    // 1. Update the opportunity stage, recalculate risk/health simply (example: lower probability if stuck, etc. For now just update stage)
    const newProbability = targetStage === "CLOSED_WON" ? 100 : targetStage === "CLOSED_LOST" ? 0 : opp.probability;

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
