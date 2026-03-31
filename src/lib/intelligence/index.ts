export { AlertEngine, DEFAULT_ALERT_RULES } from "./alert-engine";
export type { Alert, AlertSeverity, AlertType, AlertRule } from "./alert-engine";

export { RecommendationEngine } from "./recommendation-engine";
export type { Recommendation, RecommendationType } from "./recommendation-engine";

export {
  calculateMoneyAtRisk,
  calculateCommissionAtRisk,
  calculateDelayCost,
  calculateAllMoneyMetrics,
} from "./money-engine";
export type { MoneyMetrics, OpportunityData } from "./money-engine";

export {
  calculateExecutionScore,
  calculateIntentScore,
  calculateMomentumScore,
} from "./behavioral-engine";
export type { ExecutionScore, IntentScore, MomentumScore } from "./behavioral-engine";

export { selectTone, generateNarrativeContext } from "./tone-engine";
export type { ToneMode, ToneSelection, NarrativeContext } from "./tone-engine";

export { inferProfile, matchToICP, updateProfileFromDealOutcome } from "./icp-engine";
export type { ProfileMatchResult, InferredProfile, BigFive, ValueSensitivity, MotivationProfile } from "./icp-engine";

export { processDebrief, approveActions, rejectActions } from "./debrief-service";
export type { DebriefInput, DebriefResult, ActionType, Urgency, ActionProposalData } from "./debrief-service";
