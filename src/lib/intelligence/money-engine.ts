/**
 * Money Engine — Deterministic financial risk calculations.
 *
 * All values in USD ($). No LLM calls — pure math from existing data.
 *
 * Core metrics:
 *  - moneyAtRisk:      value × (1 - probability) × riskFactor
 *  - commissionAtRisk: moneyAtRisk × commissionRate
 *  - delayCost:        value × dailyDecayRate × daysOverdue
 */

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 0.1 % per day of delay past expectedCloseDate */
const DAILY_DECAY_RATE = 0.001;

/** Default commission rate (3 %) */
const DEFAULT_COMMISSION_RATE = 0.03;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoneyMetrics {
  moneyAtRisk: number;
  commissionAtRisk: number;
  delayCost: number;
  riskFactor: number;
  riskReasons: string[];
  daysOverdue: number;
  /** BRL value used in the calculation */
  dealValue: number;
  probability: number;
  calculatedAt: string; // ISO timestamp
}

export interface OpportunityData {
  id: string;
  value: number;
  probability: number;
  stage: string;
  expectedCloseDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  organizationId: string;
}

interface RiskFactorResult {
  factor: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function daysOverdue(expectedCloseDate: Date | null): number {
  if (!expectedCloseDate) return 0;
  return Math.max(0, daysSince(expectedCloseDate));
}

// ---------------------------------------------------------------------------
// Risk Factor Calculation
// ---------------------------------------------------------------------------

/**
 * Compute a risk factor (1.0 = baseline, up to ~3.0 for very risky deals).
 *
 * Signals:
 *  - daysInStage > 14 with no update  → +0.5
 *  - no activity in 7+ days           → +0.5
 *  - no meeting in 14+ days           → +0.4
 *  - declining momentum (stage stuck + value decaying) → +0.3
 */
async function computeRiskFactor(
  opp: OpportunityData,
): Promise<RiskFactorResult> {
  let factor = 1.0;
  const reasons: string[] = [];

  const stageAge = daysSince(opp.updatedAt);

  // Signal 1: stage stagnation
  if (stageAge > 14) {
    factor += 0.5;
    reasons.push(`Deal stuck in stage for ${stageAge} days (>14)`);
  }

  // Signal 2: no recent activity
  const recentActivity = await prisma.activity.findFirst({
    where: {
      opportunityId: opp.id,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (!recentActivity) {
    factor += 0.5;
    reasons.push("No activity in the last 7 days");
  }

  // Signal 3: no recent meeting
  const recentMeeting = await prisma.meeting.findFirst({
    where: {
      opportunityId: opp.id,
      startTime: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (!recentMeeting) {
    factor += 0.4;
    reasons.push("No meeting in the last 14 days");
  }

  // Signal 4: declining momentum — stage stuck AND overdue
  const overdue = daysOverdue(opp.expectedCloseDate);
  if (stageAge > 14 && overdue > 0) {
    factor += 0.3;
    reasons.push(`Deal overdue by ${overdue} days with stagnant stage`);
  }

  return { factor, reasons };
}

// ---------------------------------------------------------------------------
// Core Calculations
// ---------------------------------------------------------------------------

export function calculateMoneyAtRisk(
  value: number,
  probability: number,
  riskFactor: number,
): number {
  // probability is stored as 0–100 integer
  const prob = Math.max(0, Math.min(100, probability)) / 100;
  return value * (1 - prob) * riskFactor;
}

export function calculateCommissionAtRisk(
  moneyAtRisk: number,
  commissionRate: number = DEFAULT_COMMISSION_RATE,
): number {
  return moneyAtRisk * commissionRate;
}

export function calculateDelayCost(
  value: number,
  expectedCloseDate: Date | null,
): number {
  const days = daysOverdue(expectedCloseDate);
  return value * DAILY_DECAY_RATE * days;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Calculate all money metrics for a single opportunity.
 * This is the main entry-point used by the API route.
 */
export async function calculateAllMoneyMetrics(
  opp: OpportunityData,
  commissionRate: number = DEFAULT_COMMISSION_RATE,
): Promise<MoneyMetrics> {
  const { factor, reasons } = await computeRiskFactor(opp);

  const moneyAtRisk = calculateMoneyAtRisk(opp.value, opp.probability, factor);
  const commissionAtRisk = calculateCommissionAtRisk(moneyAtRisk, commissionRate);
  const delayCost = calculateDelayCost(opp.value, opp.expectedCloseDate);
  const overdue = daysOverdue(opp.expectedCloseDate);

  return {
    moneyAtRisk: Math.round(moneyAtRisk * 100) / 100,
    commissionAtRisk: Math.round(commissionAtRisk * 100) / 100,
    delayCost: Math.round(delayCost * 100) / 100,
    riskFactor: Math.round(factor * 100) / 100,
    riskReasons: reasons,
    daysOverdue: overdue,
    dealValue: opp.value,
    probability: opp.probability,
    calculatedAt: new Date().toISOString(),
  };
}
