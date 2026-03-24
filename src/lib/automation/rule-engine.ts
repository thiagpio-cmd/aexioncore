import { prisma } from "@/lib/db";

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export async function evaluateEntity(type: "LEAD" | "OPPORTUNITY", id: string, organizationId: string) {
  const now = Date.now();
  const generatedRecommendations: { action: string; reason: string; priority: string }[] = [];
  const generatedTasks: { title: string; description: string; type: string; ownerId: string; dueDate: Date }[] = [];

  // Helper to enforce idempotency of tasks
  const checkExistingTask = async (titlePrefix: string, ownerId: string) => {
    const existing = await prisma.task.findFirst({
      where: {
        organizationId,
        ownerId,
        status: "PENDING",
        title: { startsWith: titlePrefix },
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      }
    });
    return !!existing;
  };

  // Helper to enforce idempotency of recommendations
  const checkExistingRecommendation = async (action: string) => {
    const existing = await prisma.recommendation.findFirst({
      where: {
        organizationId,
        action,
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      }
    });
    return !!existing;
  };

  if (type === "OPPORTUNITY") {
    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: { tasks: { where: { status: "PENDING" } }, account: true }
    });
    
    if (!opp) return { tasks: 0, recommendations: 0 };

    const updatedAtMs = new Date(opp.updatedAt).getTime();
    
    // Rule 1: Stale Deal (No update in 14 days)
    if (now - updatedAtMs > STALE_MS && !opp.stage.includes("CLOSED")) {
      const recLabel = "Review Stale Deal Details";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: "Signal: Deal has not progressed or been modified in over 14 days.",
          priority: "HIGH"
        });
      }
      
      const taskLabel = "System: Review Stale Deal";
      if (!(await checkExistingTask(taskLabel, opp.ownerId))) {
        generatedTasks.push({
          title: taskLabel,
          description: "This deal has been idle. Please update the CRM logs, change the stage, or drop the deal.",
          type: "REVIEW",
          ownerId: opp.ownerId,
          dueDate: new Date(now + 24 * 60 * 60 * 1000) // Due tomorrow
        });
      }
    }

    // Rule 2: No Next Step
    if (opp.tasks.length === 0 && !opp.stage.includes("CLOSED")) {
      const recLabel = "Schedule Next Step";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: "Signal: Active deal has no pending follow-up task. Pipeline decay risk.",
          priority: "HIGH"
        });
      }

      const taskLabel = "System: Define Next Step";
      if (!(await checkExistingTask(taskLabel, opp.ownerId))) {
        generatedTasks.push({
          title: taskLabel,
          description: "Active deals require a forward-looking task. Contact the champion and schedule a follow-up.",
          type: "FOLLOW_UP",
          ownerId: opp.ownerId,
          dueDate: new Date(now + 24 * 60 * 60 * 1000)
        });
      }
    }

    // Rule 3: Past-Due Close Date
    if (opp.expectedCloseDate && new Date(opp.expectedCloseDate).getTime() < now && !opp.stage.includes("CLOSED")) {
      const recLabel = "Update Close Date";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: "Signal: Expected close date is in the past.",
          priority: "MEDIUM"
        });
      }
    }

    // Rule 4: Overdue Tasks exist
    const overdueTasks = opp.tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now);
    if (overdueTasks.length > 0) {
      const recLabel = "Clear Overdue Tasks";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: `Signal: ${overdueTasks.length} task(s) are past their due date.`,
          priority: "HIGH"
        });
      }
    }

    // Rule 5: Onboarding Delay
    if (opp.stage.includes("CLOSED_WON") && opp.account) {
      if (opp.account.implementationDelayDays && opp.account.implementationDelayDays > 14) {
         const taskLabel = "System: Address Implementation Delay";
         if (!(await checkExistingTask(taskLabel, opp.ownerId))) {
           generatedTasks.push({
             title: taskLabel,
             description: `Implementation is severely delayed (+${opp.account.implementationDelayDays} days). Escalate with CS to prevent early churn.`,
             type: "REVIEW",
             ownerId: opp.ownerId,
             dueDate: new Date(now + 24 * 60 * 60 * 1000)
           });
         }
      }
    }
  }

  if (type === "LEAD") {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { tasks: { where: { status: "PENDING" } } }
    });
    
    if (!lead) return { tasks: 0, recommendations: 0 };

    // Rule: High Fit Score but No Next Step
    if (lead.fitScore > 80 && lead.tasks.length === 0 && !["CONVERTED", "UNQUALIFIED"].includes(lead.status)) {
      const taskLabel = "System: High Fit Lead Follow-up";
      if (!(await checkExistingTask(taskLabel, lead.ownerId))) {
        generatedTasks.push({
          title: taskLabel,
          description: "Lead matches ideal customer profile but lacks a follow-up task.",
          type: "FOLLOW_UP",
          ownerId: lead.ownerId,
          dueDate: new Date(now + 24 * 60 * 60 * 1000)
        });
      }

      const recLabel = "Immediate Priority Outreach";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: "Signal: Fit score > 80 indicates high enterprise value potential.",
          priority: "HIGH"
        });
      }
    }

    // Rule: Idle Lead (Contacted but no update in 7 days)
    const updatedAtMs = new Date(lead.updatedAt).getTime();
    if (["CONTACTED"].includes(lead.status) && now - updatedAtMs > 7 * 24 * 60 * 60 * 1000) {
      const recLabel = "Re-engage or Discard Idle Lead";
      if (!(await checkExistingRecommendation(recLabel))) {
        generatedRecommendations.push({
          action: recLabel,
          reason: "Signal: Lead has been stuck in 'Contacted' for over 7 days without progress.",
          priority: "MEDIUM"
        });
      }
    }
  }

  // Persist newly generated items
  let tasksCreated = 0;
  let recsCreated = 0;

  for (const t of generatedTasks) {
    await prisma.task.create({
      data: {
        organizationId,
        title: t.title,
        description: t.description,
        type: t.type,
        ownerId: t.ownerId,
        dueDate: t.dueDate,
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      }
    });
    tasksCreated++;
  }

  for (const r of generatedRecommendations) {
    await prisma.recommendation.create({
      data: {
        organizationId,
        action: r.action,
        reason: r.reason,
        priority: r.priority,
        ...(type === "LEAD" ? { leadId: id } : { opportunityId: id })
      }
    });
    recsCreated++;
  }

  return { tasks: tasksCreated, recommendations: recsCreated };
}
