/**
 * AI Action Executor
 *
 * Executes CRM actions returned by the Activity Processor.
 * Each action type has specific confidence thresholds to prevent
 * low-confidence mutations from taking effect.
 *
 * Design principles:
 * - Every mutation is wrapped in try-catch — a failed action never breaks the pipeline
 * - All mutations are logged for audit trail
 * - High-impact mutations (deal stage changes) require higher confidence thresholds
 */

import { prisma } from "@/lib/db";
import type { AIAction } from "./activity-processor";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  action: AIAction;
  status: "executed" | "skipped" | "failed";
  reason?: string;
  entityId?: string;
}

// ─── Confidence Thresholds ──────────────────────────────────────────────────

const CONFIDENCE_THRESHOLDS: Record<AIAction["type"], number> = {
  UPDATE_LEAD_STATUS: 0.7,
  UPDATE_DEAL_STAGE: 0.8,
  CREATE_TASK: 0.6,
  FLAG_AT_RISK: 0.6,
  LOG_SUMMARY: 0.0, // Always execute
  UPDATE_TEMPERATURE: 0.6,
  SUGGEST_NEXT_ACTION: 0.0, // Always record suggestions
};

// ─── Individual Action Handlers ─────────────────────────────────────────────

async function executeUpdateLeadStatus(
  action: AIAction,
  context: { organizationId: string }
): Promise<ExecutionResult> {
  if (!action.targetId) {
    return { action, status: "skipped", reason: "No targetId for lead status update" };
  }

  try {
    // Verify the lead exists and belongs to the organization
    const lead = await prisma.lead.findFirst({
      where: { id: action.targetId, organizationId: context.organizationId },
    });

    if (!lead) {
      return { action, status: "skipped", reason: "Lead not found or access denied" };
    }

    const newStatus = action.data.status;
    if (!newStatus || lead.status === newStatus) {
      return { action, status: "skipped", reason: `Lead already has status ${lead.status}` };
    }

    await prisma.lead.update({
      where: { id: action.targetId },
      data: { status: newStatus },
    });

    console.log(`[ActionExecutor] Updated lead ${action.targetId} status to ${newStatus}`);
    return { action, status: "executed", entityId: action.targetId };
  } catch (err) {
    console.error("[ActionExecutor] UPDATE_LEAD_STATUS failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeUpdateDealStage(
  action: AIAction,
  context: { organizationId: string }
): Promise<ExecutionResult> {
  if (!action.targetId) {
    return { action, status: "skipped", reason: "No targetId for deal stage update" };
  }

  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: action.targetId, organizationId: context.organizationId },
    });

    if (!opportunity) {
      return { action, status: "skipped", reason: "Opportunity not found or access denied" };
    }

    const newStage = action.data.stage;
    if (!newStage || opportunity.stage === newStage) {
      return { action, status: "skipped", reason: `Opportunity already at stage ${opportunity.stage}` };
    }

    await prisma.opportunity.update({
      where: { id: action.targetId },
      data: { stage: newStage },
    });

    console.log(`[ActionExecutor] Updated opportunity ${action.targetId} stage to ${newStage}`);
    return { action, status: "executed", entityId: action.targetId };
  } catch (err) {
    console.error("[ActionExecutor] UPDATE_DEAL_STAGE failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeCreateTask(
  action: AIAction,
  context: { organizationId: string; userId: string }
): Promise<ExecutionResult> {
  try {
    const taskData: any = {
      organizationId: context.organizationId,
      ownerId: context.userId,
      title: action.data.title ?? "AI-generated task",
      description: action.data.description ?? action.reasoning,
      type: action.data.type ?? "FOLLOW_UP",
      priority: action.data.priority ?? "MEDIUM",
      status: "PENDING",
    };

    // Link to lead or opportunity
    if (action.targetEntity === "lead" && action.targetId) {
      taskData.leadId = action.targetId;
    } else if (action.targetEntity === "opportunity" && action.targetId) {
      taskData.opportunityId = action.targetId;
    }

    // Parse due date if provided
    if (action.data.dueDate) {
      try {
        taskData.dueDate = new Date(action.data.dueDate);
      } catch {
        // Default to 2 days from now if date parsing fails
        taskData.dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Default due date: 2 business days from now
      taskData.dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    }

    const task = await prisma.task.create({ data: taskData });

    console.log(`[ActionExecutor] Created task ${task.id}: ${taskData.title}`);
    return { action, status: "executed", entityId: task.id };
  } catch (err) {
    console.error("[ActionExecutor] CREATE_TASK failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeFlagAtRisk(
  action: AIAction,
  context: { organizationId: string; userId: string }
): Promise<ExecutionResult> {
  if (!action.targetId) {
    return { action, status: "skipped", reason: "No targetId for at-risk flag" };
  }

  try {
    // Create an insight to record the risk signal
    const insight = await prisma.insight.create({
      data: {
        organizationId: context.organizationId,
        category: "RISK",
        title: `At-Risk Signal: ${action.data.reason ?? "Risk detected"}`,
        description: action.reasoning,
        impact: "HIGH",
        confidence: Math.round(action.confidence * 100),
        suggestedAction: "Review and take corrective action immediately",
        ...(action.targetEntity === "lead" ? { leadId: action.targetId } : {}),
        ...(action.targetEntity === "opportunity" ? { opportunityId: action.targetId } : {}),
      },
    });

    console.log(`[ActionExecutor] Flagged ${action.targetEntity} ${action.targetId} at-risk (insight ${insight.id})`);
    return { action, status: "executed", entityId: insight.id };
  } catch (err) {
    console.error("[ActionExecutor] FLAG_AT_RISK failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeLogSummary(
  action: AIAction,
  context: { organizationId: string; userId: string }
): Promise<ExecutionResult> {
  try {
    const activity = await prisma.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "AI_SUMMARY",
        channel: "ai",
        subject: "AI Activity Analysis",
        body: action.data.summary ?? action.reasoning,
        creatorId: context.userId,
        leadId: action.targetEntity === "lead" ? action.targetId : undefined,
        opportunityId: action.targetEntity === "opportunity" ? action.targetId : undefined,
      },
    });

    console.log(`[ActionExecutor] Logged AI summary as activity ${activity.id}`);
    return { action, status: "executed", entityId: activity.id };
  } catch (err) {
    console.error("[ActionExecutor] LOG_SUMMARY failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeUpdateTemperature(
  action: AIAction,
  context: { organizationId: string }
): Promise<ExecutionResult> {
  if (!action.targetId) {
    return { action, status: "skipped", reason: "No targetId for temperature update" };
  }

  try {
    const lead = await prisma.lead.findFirst({
      where: { id: action.targetId, organizationId: context.organizationId },
    });

    if (!lead) {
      return { action, status: "skipped", reason: "Lead not found or access denied" };
    }

    const newTemp = action.data.temperature;
    if (!newTemp || lead.temperature === newTemp) {
      return { action, status: "skipped", reason: `Lead already has temperature ${lead.temperature}` };
    }

    await prisma.lead.update({
      where: { id: action.targetId },
      data: { temperature: newTemp },
    });

    console.log(`[ActionExecutor] Updated lead ${action.targetId} temperature to ${newTemp}`);
    return { action, status: "executed", entityId: action.targetId };
  } catch (err) {
    console.error("[ActionExecutor] UPDATE_TEMPERATURE failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

async function executeSuggestNextAction(
  action: AIAction,
  context: { organizationId: string }
): Promise<ExecutionResult> {
  try {
    // Store suggestion as a Recommendation (does not auto-execute)
    const recommendation = await prisma.recommendation.create({
      data: {
        organizationId: context.organizationId,
        action: action.data.suggestion ?? action.reasoning,
        reason: action.reasoning,
        priority: action.data.priority ?? "MEDIUM",
        leadId: action.targetEntity === "lead" ? action.targetId : undefined,
        opportunityId: action.targetEntity === "opportunity" ? action.targetId : undefined,
      },
    });

    console.log(`[ActionExecutor] Stored suggestion as recommendation ${recommendation.id}`);
    return { action, status: "executed", entityId: recommendation.id };
  } catch (err) {
    console.error("[ActionExecutor] SUGGEST_NEXT_ACTION failed:", err);
    return { action, status: "failed", reason: String(err) };
  }
}

// ─── Action Router ──────────────────────────────────────────────────────────

const ACTION_HANDLERS: Record<
  AIAction["type"],
  (action: AIAction, context: { organizationId: string; userId: string }) => Promise<ExecutionResult>
> = {
  UPDATE_LEAD_STATUS: executeUpdateLeadStatus,
  UPDATE_DEAL_STAGE: executeUpdateDealStage,
  CREATE_TASK: executeCreateTask,
  FLAG_AT_RISK: executeFlagAtRisk,
  LOG_SUMMARY: executeLogSummary,
  UPDATE_TEMPERATURE: executeUpdateTemperature,
  SUGGEST_NEXT_ACTION: executeSuggestNextAction,
};

// ─── Main Executor ──────────────────────────────────────────────────────────

export async function executeActions(
  actions: AIAction[],
  context: { organizationId: string; userId: string }
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const action of actions) {
    // Check confidence threshold
    const threshold = CONFIDENCE_THRESHOLDS[action.type] ?? 0.7;
    if (action.confidence < threshold) {
      results.push({
        action,
        status: "skipped",
        reason: `Confidence ${action.confidence.toFixed(2)} below threshold ${threshold} for ${action.type}`,
      });
      continue;
    }

    // Route to handler
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) {
      results.push({
        action,
        status: "skipped",
        reason: `Unknown action type: ${action.type}`,
      });
      continue;
    }

    const result = await handler(action, context);
    results.push(result);
  }

  // Log execution summary
  const executed = results.filter((r) => r.status === "executed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(
    `[ActionExecutor] Completed: ${executed} executed, ${skipped} skipped, ${failed} failed out of ${actions.length} actions`
  );

  return results;
}
