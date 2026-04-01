/**
 * Tone Engine — Selects narrative tone and generates structured context.
 *
 * Three modes:
 *  - pressure:  deal at risk → emphasize urgency and money loss
 *  - control:   deal stable  → emphasize next steps and metrics
 *  - champion:  deal winning → emphasize acceleration and upsell
 *
 * Returns structured data objects — NO LLM text generation.
 * The output is designed to be consumed by an LLM layer downstream.
 */

import type { MoneyMetrics } from "./money-engine";
import type { IntentScore, MomentumScore } from "./behavioral-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToneMode = "pressure" | "control" | "champion";

export interface ToneSelection {
  mode: ToneMode;
  reason: string;
  confidence: number; // 0-100
}

export interface NarrativeContext {
  tone: ToneMode;
  opportunityId: string;
  headline: string;
  urgencyLevel: "critical" | "moderate" | "low";
  keyFacts: string[];
  suggestedActions: string[];
  moneyContext: {
    moneyAtRisk: number;
    commissionAtRisk: number;
    delayCost: number;
    daysOverdue: number;
  };
  scoreContext: {
    intentScore: number;
    momentumScore: number;
    riskFactor: number;
  };
  generatedAt: string;
}

export interface OpportunityForTone {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate: Date | null;
}

export interface Scores {
  intent: IntentScore;
  momentum: MomentumScore;
}

// ---------------------------------------------------------------------------
// Tone Selection
// ---------------------------------------------------------------------------

/**
 * Select the appropriate tone mode based on risk and momentum signals.
 *
 * Decision matrix:
 *  - PRESSURE when: momentum < 40 OR (riskFactor >= 2.0 AND intent < 40)
 *  - CHAMPION when: momentum >= 70 AND intent >= 60
 *  - CONTROL otherwise
 */
export function selectTone(
  moneyMetrics: MoneyMetrics,
  scores: Scores,
): ToneSelection {
  const { riskFactor, daysOverdue, moneyAtRisk } = moneyMetrics;
  const { momentum, intent } = scores;

  // Pressure: deal is at risk
  if (momentum.score < 40) {
    return {
      mode: "pressure",
      reason: `Low momentum (${momentum.score}/100) — deal is losing speed`,
      confidence: Math.min(100, 60 + (40 - momentum.score)),
    };
  }

  if (riskFactor >= 2.0 && intent.score < 40) {
    return {
      mode: "pressure",
      reason: `High risk (factor ${riskFactor}) with low intent (${intent.score}/100)`,
      confidence: Math.min(100, 50 + Math.round(riskFactor * 10)),
    };
  }

  if (daysOverdue > 14 && moneyAtRisk > 50000) {
    return {
      mode: "pressure",
      reason: `Overdue by ${daysOverdue} days with R$ ${moneyAtRisk.toLocaleString("pt-BR")} at risk`,
      confidence: 75,
    };
  }

  // Champion: deal is winning
  if (momentum.score >= 70 && intent.score >= 60) {
    return {
      mode: "champion",
      reason: `Strong momentum (${momentum.score}/100) and intent (${intent.score}/100)`,
      confidence: Math.min(100, 50 + Math.round((momentum.score + intent.score) / 4)),
    };
  }

  // Control: stable deal
  return {
    mode: "control",
    reason: "Deal metrics within normal range — maintain execution cadence",
    confidence: 60,
  };
}

// ---------------------------------------------------------------------------
// Narrative Context
// ---------------------------------------------------------------------------

/**
 * Generate a structured narrative context object for downstream LLM consumption.
 *
 * This is NOT an LLM call — it assembles data into a format that an LLM prompt
 * can use to generate user-facing narratives later.
 */
export function generateNarrativeContext(
  opportunity: OpportunityForTone,
  moneyMetrics: MoneyMetrics,
  scores: Scores,
  tone: ToneMode,
): NarrativeContext {
  const keyFacts: string[] = [];
  const suggestedActions: string[] = [];

  // Build key facts based on data
  keyFacts.push(
    `Deal value: R$ ${opportunity.value.toLocaleString("pt-BR")}`,
  );
  keyFacts.push(
    `Current stage: ${opportunity.stage} (probability ${opportunity.probability}%)`,
  );

  if (moneyMetrics.daysOverdue > 0) {
    keyFacts.push(
      `Overdue by ${moneyMetrics.daysOverdue} days`,
    );
  }

  if (moneyMetrics.moneyAtRisk > 0) {
    keyFacts.push(
      `R$ ${moneyMetrics.moneyAtRisk.toLocaleString("pt-BR")} at risk`,
    );
  }

  if (moneyMetrics.delayCost > 0) {
    keyFacts.push(
      `Delay cost: R$ ${moneyMetrics.delayCost.toLocaleString("pt-BR")}`,
    );
  }

  // Add score signals
  for (const signal of scores.momentum.signals) {
    keyFacts.push(signal);
  }

  // Build suggested actions based on tone
  switch (tone) {
    case "pressure":
      suggestedActions.push("Schedule urgent call with decision-maker");
      if (moneyMetrics.daysOverdue > 0) {
        suggestedActions.push("Send deadline re-engagement message");
      }
      if (scores.intent.score < 30) {
        suggestedActions.push("Re-qualify deal — confirm budget and timeline");
      }
      suggestedActions.push("Escalate internally for executive sponsorship");
      break;

    case "control":
      suggestedActions.push("Confirm next steps with stakeholders");
      suggestedActions.push("Update forecast and probability based on latest signals");
      if (moneyMetrics.commissionAtRisk > 0) {
        suggestedActions.push("Address open objections to reduce risk");
      }
      break;

    case "champion":
      suggestedActions.push("Prepare contract / proposal for fast close");
      suggestedActions.push("Identify upsell or cross-sell opportunities");
      suggestedActions.push("Secure executive alignment for expansion");
      break;
  }

  // Determine urgency level
  let urgencyLevel: "critical" | "moderate" | "low";
  if (tone === "pressure") {
    urgencyLevel = moneyMetrics.moneyAtRisk > 100000 ? "critical" : "moderate";
  } else if (tone === "control") {
    urgencyLevel = "moderate";
  } else {
    urgencyLevel = "low";
  }

  // Build headline
  let headline: string;
  switch (tone) {
    case "pressure":
      headline = `"${opportunity.title}" needs urgent attention — $${moneyMetrics.moneyAtRisk.toLocaleString("en-US")} at risk`;
      break;
    case "control":
      headline = `"${opportunity.title}" is stable — maintain execution pace`;
      break;
    case "champion":
      headline = `"${opportunity.title}" trending up — accelerate to close`;
      break;
  }

  return {
    tone,
    opportunityId: opportunity.id,
    headline,
    urgencyLevel,
    keyFacts,
    suggestedActions,
    moneyContext: {
      moneyAtRisk: moneyMetrics.moneyAtRisk,
      commissionAtRisk: moneyMetrics.commissionAtRisk,
      delayCost: moneyMetrics.delayCost,
      daysOverdue: moneyMetrics.daysOverdue,
    },
    scoreContext: {
      intentScore: scores.intent.score,
      momentumScore: scores.momentum.score,
      riskFactor: moneyMetrics.riskFactor,
    },
    generatedAt: new Date().toISOString(),
  };
}
