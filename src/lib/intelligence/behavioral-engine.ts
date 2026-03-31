/**
 * Behavioral Engine — Deterministic scoring of user execution and deal signals.
 *
 * User-level:
 *  - executionScore (0-100): composite of 5 weighted sub-metrics
 *
 * Deal-level:
 *  - intentScore (0-100): buyer intent inferred from inbound activity patterns
 *  - momentumScore (0-100): deal velocity inferred from stage progression & activity
 *
 * No LLM calls — pure math from existing data.
 */

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionScore {
  total: number; // 0-100
  breakdown: {
    taskCompletionRate: number;   // raw 0-100
    responseTime: number;         // raw 0-100
    activityConsistency: number;  // raw 0-100
    followUpRate: number;         // raw 0-100
    meetingRate: number;          // raw 0-100
  };
  weights: {
    taskCompletionRate: number;
    responseTime: number;
    activityConsistency: number;
    followUpRate: number;
    meetingRate: number;
  };
  calculatedAt: string;
}

export interface IntentScore {
  score: number; // 0-100
  signals: string[];
  calculatedAt: string;
}

export interface MomentumScore {
  score: number; // 0-100
  signals: string[];
  calculatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXECUTION_WEIGHTS = {
  taskCompletionRate: 25,
  responseTime: 25,
  activityConsistency: 20,
  followUpRate: 15,
  meetingRate: 15,
} as const;

/** Look-back window for execution score calculation (30 days) */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// User-Level: Execution Score
// ---------------------------------------------------------------------------

export async function calculateExecutionScore(
  userId: string,
  organizationId: string,
): Promise<ExecutionScore> {
  const since = new Date(Date.now() - LOOKBACK_MS);

  // ── 1. Task Completion Rate ───────────────────────────────────────────
  const [totalTasks, completedTasks] = await Promise.all([
    prisma.task.count({
      where: { ownerId: userId, createdAt: { gte: since } },
    }),
    prisma.task.count({
      where: { ownerId: userId, status: "COMPLETED", createdAt: { gte: since } },
    }),
  ]);
  const taskCompletionRaw = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 50;

  // ── 2. Response Time (avg hours to respond to inbound) ────────────────
  // We look at inbound activities and measure time until the user's next outbound
  // Get opportunity IDs owned by this user to filter activities
  const userOpps = await prisma.opportunity.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const userOppIds = userOpps.map((o) => o.id);

  const inboundActivities = await prisma.activity.findMany({
    where: {
      opportunityId: { in: userOppIds },
      direction: "inbound",
      createdAt: { gte: since },
    },
    select: { id: true, opportunityId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let totalResponseHours = 0;
  let responseCount = 0;

  for (const inbound of inboundActivities) {
    const nextOutbound = await prisma.activity.findFirst({
      where: {
        opportunityId: inbound.opportunityId,
        direction: "outbound",
        creatorId: userId,
        createdAt: { gt: inbound.createdAt },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (nextOutbound) {
      const hours = (nextOutbound.createdAt.getTime() - inbound.createdAt.getTime()) / (1000 * 60 * 60);
      totalResponseHours += hours;
      responseCount++;
    }
  }

  // Score: 100 if avg <= 1h, 0 if avg >= 48h, linear between
  const avgResponseHours = responseCount > 0 ? totalResponseHours / responseCount : 24;
  const responseTimeRaw = clamp(100 - ((avgResponseHours - 1) / 47) * 100);

  // ── 3. Activity Consistency (lower stddev = more consistent = better) ─
  const activities = await prisma.activity.findMany({
    where: {
      creatorId: userId,
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  });

  // Group by day
  const dayCounts = new Map<string, number>();
  const numDays = Math.max(1, Math.ceil(LOOKBACK_MS / (1000 * 60 * 60 * 24)));
  // Initialize all days to 0
  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayCounts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const act of activities) {
    const key = act.createdAt.toISOString().slice(0, 10);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const dailyCounts = Array.from(dayCounts.values());
  const sd = stddev(dailyCounts);
  // Score: 100 if stddev=0 (perfect consistency), 0 if stddev >= 10
  const activityConsistencyRaw = clamp(100 - (sd / 10) * 100);

  // ── 4. Follow-Up Rate ─────────────────────────────────────────────────
  const [opportunitiesTouched, followUpsCreated] = await Promise.all([
    prisma.opportunity.count({
      where: {
        ownerId: userId,
        organizationId,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
      },
    }),
    prisma.task.count({
      where: {
        ownerId: userId,
        type: "FOLLOW_UP",
        createdAt: { gte: since },
      },
    }),
  ]);
  const followUpRateRaw = opportunitiesTouched > 0
    ? clamp((followUpsCreated / opportunitiesTouched) * 100)
    : 50;

  // ── 5. Meeting Rate ───────────────────────────────────────────────────
  const meetingsHeld = await prisma.meeting.count({
    where: {
      ownerId: userId,
      startTime: { gte: since },
    },
  });
  const activeOpps = opportunitiesTouched || 1;
  // Target: at least 1 meeting per active opp per month
  const meetingRateRaw = clamp((meetingsHeld / activeOpps) * 100);

  // ── Weighted Total ────────────────────────────────────────────────────
  const total = clamp(
    (taskCompletionRaw * EXECUTION_WEIGHTS.taskCompletionRate +
      responseTimeRaw * EXECUTION_WEIGHTS.responseTime +
      activityConsistencyRaw * EXECUTION_WEIGHTS.activityConsistency +
      followUpRateRaw * EXECUTION_WEIGHTS.followUpRate +
      meetingRateRaw * EXECUTION_WEIGHTS.meetingRate) / 100,
  );

  return {
    total,
    breakdown: {
      taskCompletionRate: clamp(taskCompletionRaw),
      responseTime: clamp(responseTimeRaw),
      activityConsistency: clamp(activityConsistencyRaw),
      followUpRate: clamp(followUpRateRaw),
      meetingRate: clamp(meetingRateRaw),
    },
    weights: { ...EXECUTION_WEIGHTS },
    calculatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Deal-Level: Intent Score
// ---------------------------------------------------------------------------

/**
 * Intent Score — measures buyer intent based on inbound signals.
 *
 * Factors:
 *  - Inbound message frequency (last 14 days)
 *  - Response speed from the prospect
 *  - Meeting attendance / scheduling
 */
export async function calculateIntentScore(
  opportunityId: string,
): Promise<IntentScore> {
  const signals: string[] = [];
  let score = 50; // Baseline

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Factor 1: inbound message frequency
  const inboundCount = await prisma.activity.count({
    where: {
      opportunityId,
      direction: "inbound",
      createdAt: { gte: twoWeeksAgo },
    },
  });

  if (inboundCount >= 5) {
    score += 20;
    signals.push(`High inbound activity (${inboundCount} messages in 14 days)`);
  } else if (inboundCount >= 2) {
    score += 10;
    signals.push(`Moderate inbound activity (${inboundCount} messages in 14 days)`);
  } else if (inboundCount === 0) {
    score -= 15;
    signals.push("No inbound messages in 14 days");
  }

  // Factor 2: prospect response speed (inbound following our outbound)
  const recentOutbound = await prisma.activity.findMany({
    where: {
      opportunityId,
      direction: "outbound",
      createdAt: { gte: twoWeeksAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  let fastResponses = 0;
  for (const outbound of recentOutbound) {
    const reply = await prisma.activity.findFirst({
      where: {
        opportunityId,
        direction: "inbound",
        createdAt: { gt: outbound.createdAt },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (reply) {
      const hours = (reply.createdAt.getTime() - outbound.createdAt.getTime()) / (1000 * 60 * 60);
      if (hours < 24) fastResponses++;
    }
  }

  if (recentOutbound.length > 0 && fastResponses >= recentOutbound.length * 0.6) {
    score += 15;
    signals.push("Prospect responds quickly (<24h)");
  }

  // Factor 3: meeting attendance
  const meetingCount = await prisma.meeting.count({
    where: {
      opportunityId,
      startTime: { gte: twoWeeksAgo },
    },
  });

  if (meetingCount >= 2) {
    score += 15;
    signals.push(`Multiple meetings scheduled (${meetingCount} in 14 days)`);
  } else if (meetingCount === 1) {
    score += 8;
    signals.push("Meeting scheduled in last 14 days");
  } else {
    score -= 10;
    signals.push("No meetings in 14 days");
  }

  return {
    score: clamp(score),
    signals,
    calculatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Deal-Level: Momentum Score
// ---------------------------------------------------------------------------

/**
 * Momentum Score — measures deal velocity and forward motion.
 *
 * Factors:
 *  - Stage progression speed (stage changes vs age)
 *  - Activity recency
 *  - Task completion on this deal
 */
export async function calculateMomentumScore(
  opportunityId: string,
): Promise<MomentumScore> {
  const signals: string[] = [];
  let score = 50; // Baseline

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { createdAt: true, stage: true, updatedAt: true },
  });

  if (!opp) {
    return { score: 0, signals: ["Opportunity not found"], calculatedAt: new Date().toISOString() };
  }

  // Factor 1: stage progression speed
  // Count stage-change activities
  const stageChanges = await prisma.activity.count({
    where: {
      opportunityId,
      type: "STAGE_CHANGE",
    },
  });

  const dealAge = Math.max(1, daysSince(opp.createdAt));
  const progressionRate = stageChanges / dealAge; // stage changes per day

  if (progressionRate > 0.1) {
    score += 20;
    signals.push(`Fast stage progression (${stageChanges} changes in ${dealAge} days)`);
  } else if (progressionRate > 0.03) {
    score += 10;
    signals.push("Normal stage progression");
  } else if (stageChanges === 0 && dealAge > 14) {
    score -= 20;
    signals.push(`No stage changes in ${dealAge} days`);
  }

  // Factor 2: activity recency
  const lastActivity = await prisma.activity.findFirst({
    where: { opportunityId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (lastActivity) {
    const daysSinceActivity = daysSince(lastActivity.createdAt);
    if (daysSinceActivity <= 2) {
      score += 15;
      signals.push("Activity in the last 2 days");
    } else if (daysSinceActivity <= 7) {
      score += 5;
      signals.push(`Last activity ${daysSinceActivity} days ago`);
    } else {
      score -= 15;
      signals.push(`No activity in ${daysSinceActivity} days`);
    }
  } else {
    score -= 20;
    signals.push("No activity recorded");
  }

  // Factor 3: task completion
  const [totalTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { opportunityId } }),
    prisma.task.count({ where: { opportunityId, status: "COMPLETED" } }),
  ]);

  if (totalTasks > 0) {
    const completionRate = completedTasks / totalTasks;
    if (completionRate >= 0.8) {
      score += 15;
      signals.push(`High task completion (${completedTasks}/${totalTasks})`);
    } else if (completionRate >= 0.5) {
      score += 5;
      signals.push(`Moderate task completion (${completedTasks}/${totalTasks})`);
    } else {
      score -= 10;
      signals.push(`Low task completion (${completedTasks}/${totalTasks})`);
    }
  }

  return {
    score: clamp(score),
    signals,
    calculatedAt: new Date().toISOString(),
  };
}
