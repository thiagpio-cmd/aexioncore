import { prisma } from "@/lib/db";
import { auditStageChange } from "@/server/audit";
import { OPP_STAGE_TRANSITIONS, STAGE_DEFAULT_PROBABILITY, type OppStage } from "@/lib/domain/enums";

export interface StageTransitionParams {
  opportunityId: string;
  organizationId: string;
  actorId: string;
  targetStage: string;
  note?: string;
  lossReason?: string;
  lossNotes?: string;
  nextStepTask?: {
    title: string;
    dueDate?: string;
  };
}

export async function transitionOpportunityStage(params: StageTransitionParams) {
  const { opportunityId, organizationId, actorId, targetStage, note, lossReason, lossNotes, nextStepTask } = params;

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

    // Require lossReason when closing as lost
    const VALID_LOSS_REASONS = ["PRICE", "COMPETITOR", "TIMING", "FIT", "NO_BUDGET", "NO_DECISION", "OTHER"];
    if (targetStage === "CLOSED_LOST" && !lossReason) {
      throw new Error("lossReason is required when closing a deal as lost");
    }
    if (lossReason && !VALID_LOSS_REASONS.includes(lossReason)) {
      throw new Error(`Invalid lossReason. Must be one of: ${VALID_LOSS_REASONS.join(", ")}`);
    }

    // Auto-adjust probability based on stage defaults
    const newProbability = STAGE_DEFAULT_PROBABILITY[targetStage as OppStage] ?? opp.probability;
    const isClosed = targetStage === "CLOSED_WON" || targetStage === "CLOSED_LOST";

    const updated = await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        stage: targetStage,
        probability: newProbability,
        ...(isClosed && { closedAt: new Date() }),
        ...(targetStage === "CLOSED_LOST" && { lossReason, lossNotes: lossNotes || null }),
        // Clear loss fields if reopening
        ...(!isClosed && opp.stage.startsWith("CLOSED") && { closedAt: null, lossReason: null, lossNotes: null }),
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
