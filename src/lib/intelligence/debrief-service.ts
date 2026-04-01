/**
 * Smart Debrief Service
 *
 * User inputs free text about a deal → AI interprets commercially →
 * generates action proposals → user approves/rejects each action.
 *
 * NEVER auto-executes. AI suggests → user approves.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { defaultRouter } from "@/lib/ai";
import type { AIContext } from "@/lib/ai";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActionType =
  | "create_task"
  | "update_stage"
  | "schedule_meeting"
  | "send_followup"
  | "flag_risk"
  | "update_forecast"
  | "escalate";

export type Urgency = "immediate" | "today" | "this_week";

export interface DebriefInput {
  text: string;
  opportunityId: string;
  userId: string;
  orgId: string;
}

export interface ActionProposalData {
  actionType: ActionType;
  description: string;
  urgency: Urgency;
  params: Record<string, unknown>;
  financialImpact: string | null;
}

export interface DebriefResult {
  debrief: {
    id: string;
    interpretation: Record<string, unknown> | null;
    status: string;
    confidence: number | null;
    createdAt: Date;
  };
  proposals: Array<{
    id: string;
    actionType: string;
    description: string;
    urgency: string;
    financialImpact: string | null;
    status: string;
    params: Record<string, unknown>;
  }>;
}

// ─── AI Prompt ──────────────────────────────────────────────────────────────

const DEBRIEF_SYSTEM_PROMPT = `You are a commercial assistant specialized in B2B sales.

Your role is to interpret informal meeting/interaction reports and extract structured information.

When receiving a report, you MUST return a JSON with the following structure:

{
  "interpretation": {
    "keyFacts": ["list of identified key facts"],
    "sentiment": "positive" | "neutral" | "negative" | "mixed",
    "urgency": "high" | "medium" | "low",
    "dealSignals": {
      "interest": ["identified interest signals"],
      "objections": ["mentioned objections"],
      "delays": ["delay factors"],
      "commitments": ["commitments made"]
    },
    "entitiesMentioned": ["names of people, companies, products mentioned"],
    "summary": "commercial summary in 2-3 sentences"
  },
  "actions": [
    {
      "actionType": "create_task" | "update_stage" | "schedule_meeting" | "send_followup" | "flag_risk" | "update_forecast" | "escalate",
      "description": "clear description of the suggested action",
      "urgency": "immediate" | "today" | "this_week",
      "params": {
        // Action-specific parameters:
        // create_task: { "taskTitle": "...", "dueDate": "..." }
        // update_stage: { "targetStage": "...", "reason": "..." }
        // schedule_meeting: { "subject": "...", "suggestedDate": "...", "participants": [...] }
        // send_followup: { "channel": "email" | "phone" | "whatsapp", "subject": "...", "keyPoints": [...] }
        // flag_risk: { "riskType": "...", "severity": "high" | "medium" | "low" }
        // update_forecast: { "newProbability": 0-100, "reason": "..." }
        // escalate: { "reason": "...", "suggestedEscalateTo": "..." }
      },
      "financialImpact": "estimated financial impact in USD (e.g., '$150,000 at risk of loss' or '$80,000 possible upsell')"
    }
  ]
}

Rules:
1. Always extract commercial facts even from informal/colloquial text
2. Identify deal signals: interest, objection, delay, commitment
3. Quantify financial impact in USD whenever possible
4. Suggest specific actions with clear priority
5. Use English in all outputs
6. Each action MUST have an estimated financial impact
7. Be conservative in estimates — better to underestimate than overestimate
8. Respond ONLY with the JSON, no additional text`;

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Process a debrief: interpret free text via AI and generate action proposals.
 */
export async function processDebrief(input: DebriefInput): Promise<DebriefResult> {
  const { text, opportunityId, userId, orgId } = input;

  // 1. Fetch opportunity context
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      stageRelation: { select: { id: true, name: true } },
      tasks: {
        where: { status: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, dueDate: true },
      },
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  if (opportunity.organizationId !== orgId) {
    throw new Error("Access denied to this opportunity");
  }

  // 2. Build context for AI
  const contextData = {
    opportunity: {
      title: opportunity.title,
      value: opportunity.value,
      stage: opportunity.stage,
      stageName: opportunity.stageRelation?.name ?? opportunity.stage,
      probability: opportunity.probability,
      accountName: opportunity.account?.name,
      ownerName: opportunity.owner?.name,
      expectedCloseDate: opportunity.expectedCloseDate,
      openTasks: opportunity.tasks,
    },
    debriefText: text,
  };

  const aiContext: AIContext = {
    entityType: "debrief",
    entityId: opportunityId,
    organizationId: orgId,
    data: contextData,
  };

  // 3. Call AI to interpret the debrief
  const prompt = buildPrompt(text, contextData);

  const aiResult = await defaultRouter.execute("generate_text", aiContext, {
    prompt,
  });

  // 4. Parse AI response
  const parsed = parseAIResponse(aiResult.content);

  // 5. Save debrief record
  const debrief = await prisma.debrief.create({
    data: {
      organizationId: orgId,
      opportunityId,
      userId,
      inputType: "text",
      rawInput: text,
      interpretation: (parsed.interpretation ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      proposedActions: (parsed.actions ?? []) as unknown as Prisma.InputJsonValue,
      status: "pending",
      confidence: aiResult.confidence,
    },
  });

  // 6. Create action proposals
  const proposals = await Promise.all(
    (parsed.actions ?? []).map((action: ActionProposalData) =>
      prisma.actionProposal.create({
        data: {
          organizationId: orgId,
          opportunityId,
          userId,
          debriefId: debrief.id,
          source: "debrief",
          actionType: action.actionType,
          description: action.description,
          urgency: action.urgency ?? "this_week",
          params: (action.params ?? {}) as Prisma.InputJsonValue,
          financialImpact: action.financialImpact ?? null,
          status: "proposed",
        },
      })
    )
  );

  return {
    debrief: {
      id: debrief.id,
      interpretation: parsed.interpretation,
      status: debrief.status,
      confidence: debrief.confidence,
      createdAt: debrief.createdAt,
    },
    proposals: proposals.map((p) => ({
      id: p.id,
      actionType: p.actionType,
      description: p.description,
      urgency: p.urgency,
      financialImpact: p.financialImpact,
      status: p.status,
      params: p.params as Record<string, unknown>,
    })),
  };
}

/**
 * Approve action proposals — mark as approved and execute the actions.
 */
export async function approveActions(
  debriefId: string,
  proposalIds: string[],
  userId: string,
  orgId: string
): Promise<{ approved: number; executed: number; errors: string[] }> {
  // Validate debrief ownership + tenant
  const debrief = await prisma.debrief.findUnique({
    where: { id: debriefId },
  });

  if (!debrief || debrief.organizationId !== orgId) {
    throw new Error("Debrief not found");
  }

  const proposals = await prisma.actionProposal.findMany({
    where: {
      id: { in: proposalIds },
      debriefId,
      organizationId: orgId,
      status: "proposed",
    },
  });

  if (proposals.length === 0) {
    throw new Error("No valid proposals found for approval");
  }

  let executed = 0;
  const errors: string[] = [];

  for (const proposal of proposals) {
    try {
      await executeAction(proposal, orgId, userId);

      await prisma.actionProposal.update({
        where: { id: proposal.id },
        data: { status: "executed", executedAt: new Date() },
      });

      executed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Proposal ${proposal.id}: ${msg}`);

      // Mark as approved even if execution failed — user approved it
      await prisma.actionProposal.update({
        where: { id: proposal.id },
        data: { status: "approved" },
      });
    }
  }

  // Update debrief status if all proposals are resolved
  await updateDebriefStatus(debriefId);

  // Save approved actions to debrief record
  const allApproved = await prisma.actionProposal.findMany({
    where: {
      debriefId,
      status: { in: ["approved", "executed"] },
    },
  });

  await prisma.debrief.update({
    where: { id: debriefId },
    data: {
      approvedActions: allApproved.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        description: a.description,
        status: a.status,
      })),
    },
  });

  return { approved: proposals.length, executed, errors };
}

/**
 * Reject action proposals.
 */
export async function rejectActions(
  debriefId: string,
  proposalIds: string[],
  userId: string,
  orgId: string,
  reason?: string
): Promise<{ rejected: number }> {
  const debrief = await prisma.debrief.findUnique({
    where: { id: debriefId },
  });

  if (!debrief || debrief.organizationId !== orgId) {
    throw new Error("Debrief not found");
  }

  const result = await prisma.actionProposal.updateMany({
    where: {
      id: { in: proposalIds },
      debriefId,
      organizationId: orgId,
      status: "proposed",
    },
    data: { status: "rejected" },
  });

  await updateDebriefStatus(debriefId);

  return { rejected: result.count };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function buildPrompt(
  text: string,
  context: Record<string, unknown>
): string {
  const opp = context.opportunity as Record<string, unknown>;

  return `${DEBRIEF_SYSTEM_PROMPT}

---

OPPORTUNITY CONTEXT:
- Name: ${opp.title}
- Value: $${Number(opp.value ?? 0).toLocaleString("en-US")}
- Stage: ${opp.stageName}
- Current probability: ${opp.probability ?? "N/A"}%
- Account: ${opp.accountName ?? "N/A"}
- Owner: ${opp.ownerName ?? "N/A"}
- Expected close date: ${opp.expectedCloseDate ?? "N/A"}
- Open tasks: ${JSON.stringify(opp.openTasks ?? [])}

---

SALES REP REPORT:
${text}

---

Analyze the report above and return the structured JSON as instructed.`;
}

function parseAIResponse(content: string): {
  interpretation: Record<string, unknown> | null;
  actions: ActionProposalData[];
} {
  try {
    // Try to extract JSON from the response (may have markdown fences)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      content.match(/(\{[\s\S]*\})/);

    const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const parsed = JSON.parse(raw);

    return {
      interpretation: parsed.interpretation ?? null,
      actions: Array.isArray(parsed.actions)
        ? parsed.actions.map(sanitizeAction)
        : [],
    };
  } catch {
    console.error("Failed to parse AI debrief response:", content.slice(0, 500));
    return {
      interpretation: { rawResponse: content, parseError: true },
      actions: [],
    };
  }
}

const VALID_ACTION_TYPES: ActionType[] = [
  "create_task",
  "update_stage",
  "schedule_meeting",
  "send_followup",
  "flag_risk",
  "update_forecast",
  "escalate",
];

const VALID_URGENCIES: Urgency[] = ["immediate", "today", "this_week"];

function sanitizeAction(raw: Record<string, unknown>): ActionProposalData {
  const actionType = VALID_ACTION_TYPES.includes(raw.actionType as ActionType)
    ? (raw.actionType as ActionType)
    : "create_task";

  const urgency = VALID_URGENCIES.includes(raw.urgency as Urgency)
    ? (raw.urgency as Urgency)
    : "this_week";

  return {
    actionType,
    description: String(raw.description ?? "AI-suggested action"),
    urgency,
    params: (raw.params as Record<string, unknown>) ?? {},
    financialImpact: raw.financialImpact ? String(raw.financialImpact) : null,
  };
}

/**
 * Execute an approved action — creates real records in the system.
 */
async function executeAction(
  proposal: {
    id: string;
    actionType: string;
    params: unknown;
    opportunityId: string;
    userId: string;
    description: string;
  },
  orgId: string,
  userId: string
): Promise<void> {
  const params = (proposal.params ?? {}) as Record<string, unknown>;

  switch (proposal.actionType) {
    case "create_task": {
      await prisma.task.create({
        data: {
          title: String(params.taskTitle ?? proposal.description),
          description: `[Smart Debrief] ${proposal.description}`,
          status: "TODO",
          priority: "HIGH",
          organizationId: orgId,
          opportunityId: proposal.opportunityId,
          ownerId: userId,
          dueDate: params.dueDate ? new Date(String(params.dueDate)) : null,
        },
      });
      break;
    }

    case "update_stage": {
      if (params.targetStage) {
        await prisma.opportunity.update({
          where: { id: proposal.opportunityId },
          data: { stage: String(params.targetStage) },
        });
      }
      break;
    }

    case "update_forecast": {
      if (params.newProbability !== undefined) {
        await prisma.opportunity.update({
          where: { id: proposal.opportunityId },
          data: { probability: Number(params.newProbability) },
        });
      }
      break;
    }

    case "flag_risk": {
      await prisma.task.create({
        data: {
          title: `⚠️ RISK: ${String(params.riskType ?? "Risk identified")}`,
          description: `[Smart Debrief — Risk Flag]\n${proposal.description}\nSeverity: ${String(params.severity ?? "medium")}`,
          status: "TODO",
          priority: "URGENT",
          organizationId: orgId,
          opportunityId: proposal.opportunityId,
          ownerId: userId,
        },
      });
      break;
    }

    case "schedule_meeting": {
      await prisma.task.create({
        data: {
          title: `📅 Schedule: ${String(params.subject ?? "Meeting")}`,
          description: `[Smart Debrief — Meeting]\n${proposal.description}\nParticipants: ${JSON.stringify(params.participants ?? [])}`,
          status: "TODO",
          priority: "HIGH",
          organizationId: orgId,
          opportunityId: proposal.opportunityId,
          ownerId: userId,
          dueDate: params.suggestedDate ? new Date(String(params.suggestedDate)) : null,
        },
      });
      break;
    }

    case "send_followup": {
      await prisma.task.create({
        data: {
          title: `📩 Follow-up: ${String(params.subject ?? "Follow-up")}`,
          description: `[Smart Debrief — Follow-up]\nChannel: ${String(params.channel ?? "email")}\nKey points: ${JSON.stringify(params.keyPoints ?? [])}\n\n${proposal.description}`,
          status: "TODO",
          priority: "HIGH",
          organizationId: orgId,
          opportunityId: proposal.opportunityId,
          ownerId: userId,
        },
      });
      break;
    }

    case "escalate": {
      await prisma.task.create({
        data: {
          title: `🚨 Escalation: ${String(params.reason ?? "Requires attention")}`,
          description: `[Smart Debrief — Escalation]\n${proposal.description}\nEscalate to: ${String(params.suggestedEscalateTo ?? "management")}`,
          status: "TODO",
          priority: "URGENT",
          organizationId: orgId,
          opportunityId: proposal.opportunityId,
          ownerId: userId,
        },
      });
      break;
    }

    default:
      console.warn(`Unknown action type: ${proposal.actionType}`);
  }
}

/**
 * Update debrief status based on its proposals' statuses.
 */
async function updateDebriefStatus(debriefId: string): Promise<void> {
  const proposals = await prisma.actionProposal.findMany({
    where: { debriefId },
    select: { status: true },
  });

  if (proposals.length === 0) return;

  const allResolved = proposals.every((p) =>
    ["approved", "executed", "rejected"].includes(p.status)
  );

  if (allResolved) {
    const hasApproved = proposals.some((p) =>
      ["approved", "executed"].includes(p.status)
    );

    await prisma.debrief.update({
      where: { id: debriefId },
      data: {
        status: hasApproved ? "applied" : "reviewed",
      },
    });
  } else {
    await prisma.debrief.update({
      where: { id: debriefId },
      data: { status: "reviewed" },
    });
  }
}
