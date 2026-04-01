/**
 * ICP Psychographic Profiling Engine
 *
 * Deterministic inference of customer psychographic profiles from behavioral data.
 * No LLM calls — pure heuristics from Activity, InboxMessage, Meeting, and Opportunity signals.
 *
 * Theoretical frameworks:
 *  - Big Five (OCEAN) personality model
 *  - Jungian archetypes
 *  - Zeithaml & Bitner perceived-value dimensions
 *  - Deci & Ryan Self-Determination Theory (SDT)
 *  - BJ Fogg Behavior Model (BMAP)
 */

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BigFive {
  openness: number;         // 0-100
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export type JungArchetype =
  | "hero"
  | "explorer"
  | "sage"
  | "rebel"
  | "magician"
  | "lover"
  | "caregiver"
  | "ruler";

export interface Lifestyle {
  interests: string[];
  values: string[];
  priorities: string[];
}

export interface ValueSensitivity {
  functional: number;   // 0-100
  emotional: number;
  social: number;
  epistemic: number;
  conditional: number;
}

export interface MotivationProfile {
  autonomy: number;     // 0-100
  competence: number;
  relatedness: number;
}

export interface ConditioningProfile {
  rewardSensitivity: number; // 0-100
  lossAversion: number;
  habituationRate: number;
}

export interface InferredProfile {
  bigFive: BigFive;
  jungArchetype: JungArchetype;
  lifestyle: Lifestyle;
  valueSensitivity: ValueSensitivity;
  motivationProfile: MotivationProfile;
  conditioningProfile: ConditioningProfile;
  fomapScore: number;
  confidence: number;
}

export interface ProfileMatchResult {
  score: number;          // 0-100 overall match
  dimensionScores: {
    bigFive: number;
    valueSensitivity: number;
    motivation: number;
    conditioning: number;
    archetype: number;
  };
  signals: string[];
  matchedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 90;
const LOOKBACK_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

const ARCHETYPE_MAP: Record<string, JungArchetype> = {
  high_openness_high_autonomy: "explorer",
  high_openness_high_competence: "sage",
  high_extraversion_high_agreeableness: "caregiver",
  high_extraversion_low_agreeableness: "rebel",
  high_conscientiousness_high_competence: "ruler",
  high_neuroticism_high_relatedness: "lover",
  low_neuroticism_high_autonomy: "hero",
  default: "magician",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalize(value: number, minInput: number, maxInput: number): number {
  if (maxInput === minInput) return 50;
  return clamp(((value - minInput) / (maxInput - minInput)) * 100);
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Core: Infer Profile
// ---------------------------------------------------------------------------

/**
 * Analyze a contact's activities, messages, meetings, and deal history
 * to infer a psychographic profile. Pure heuristics, no LLM.
 */
export async function inferProfile(
  contactId: string,
  organizationId: string,
): Promise<InferredProfile> {
  const since = new Date(Date.now() - LOOKBACK_MS);

  // ── Gather raw signals ─────────────────────────────────────────────────

  // Find opportunities linked to this contact
  const opportunities = await prisma.opportunity.findMany({
    where: {
      organizationId,
      primaryContactId: contactId,
    },
    select: {
      id: true,
      stage: true,
      value: true,
      valueBRL: true,
      probability: true,
      expectedCloseDate: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
      priceSensitivity: true,
      lossReason: true,
    },
  });

  const oppIds = opportunities.map((o) => o.id);

  // Activities on those opportunities
  const [activities, inboxMessages, meetings] = await Promise.all([
    prisma.activity.findMany({
      where: {
        opportunityId: { in: oppIds.length > 0 ? oppIds : ["__none__"] },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        type: true,
        direction: true,
        subject: true,
        body: true,
        createdAt: true,
        channel: true,
      },
      orderBy: { createdAt: "asc" },
    }),

    prisma.inboxMessage.findMany({
      where: {
        contactId,
        organizationId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        direction: true,
        subject: true,
        body: true,
        createdAt: true,
        channel: true,
      },
      orderBy: { createdAt: "asc" },
    }),

    prisma.meeting.findMany({
      where: {
        contactId,
        startTime: { gte: since },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        notes: true,
      },
    }),
  ]);

  // ── Compute signals ────────────────────────────────────────────────────

  const inboundActivities = activities.filter((a) => a.direction === "inbound");
  const outboundActivities = activities.filter((a) => a.direction === "outbound");
  const inboundMessages = inboxMessages.filter((m) => m.direction === "inbound");
  const totalInbound = inboundActivities.length + inboundMessages.length;
  const totalOutbound = outboundActivities.length + inboxMessages.filter((m) => m.direction === "outbound").length;

  // Communication frequency (messages per week)
  const weeksInWindow = Math.max(1, LOOKBACK_DAYS / 7);
  const inboundPerWeek = totalInbound / weeksInWindow;
  const totalCommsPerWeek = (totalInbound + totalOutbound) / weeksInWindow;

  // Response speed: average hours between outbound and next inbound
  const responseTimes: number[] = [];
  for (const outbound of outboundActivities.slice(0, 50)) {
    const nextInbound = inboundActivities.find(
      (a) => a.createdAt > outbound.createdAt,
    );
    if (nextInbound) {
      const hours =
        (nextInbound.createdAt.getTime() - outbound.createdAt.getTime()) /
        (1000 * 60 * 60);
      if (hours > 0 && hours < 720) responseTimes.push(hours); // cap at 30 days
    }
  }
  const avgResponseHours =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 48;

  // Question detection: count lines with "?" in inbound content
  const allInboundText = [
    ...inboundActivities.map((a) => `${a.subject ?? ""} ${a.body ?? ""}`),
    ...inboundMessages.map((m) => `${m.subject ?? ""} ${m.body ?? ""}`),
  ].join("\n");
  const questionCount = (allInboundText.match(/\?/g) || []).length;
  const questionsPerMessage = totalInbound > 0 ? questionCount / totalInbound : 0;

  // Stage changes (negotiation signals)
  const stageChangeActivities = activities.filter(
    (a) => a.type === "STAGE_CHANGE",
  );
  const stageChanges = stageChangeActivities.length;

  // Deal urgency: how often expectedCloseDate was moved forward vs back
  // Price sensitivity from opportunity data
  const avgPriceSensitivity =
    opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + (o.priceSensitivity ?? 50), 0) /
        opportunities.length
      : 50;

  // Meeting engagement
  const meetingCount = meetings.length;
  const meetingsPerMonth = meetingCount / Math.max(1, LOOKBACK_DAYS / 30);

  // Deal outcomes
  const closedWon = opportunities.filter(
    (o) => o.stage === "CLOSED_WON" || o.stage === "closed_won",
  );
  const closedLost = opportunities.filter(
    (o) => o.stage === "CLOSED_LOST" || o.stage === "closed_lost",
  );

  // ── Big Five Inference ─────────────────────────────────────────────────

  // Openness: questions asked, variety of topics, willingness to explore
  const openness = clamp(
    normalize(questionsPerMessage, 0, 3) * 0.6 +
      normalize(stageChanges, 0, 10) * 0.2 +
      normalize(meetingsPerMonth, 0, 4) * 0.2,
  );

  // Conscientiousness: response speed, follow-through, meeting attendance
  const conscientiousness = clamp(
    normalize(48 - avgResponseHours, 0, 48) * 0.5 +
      normalize(meetingsPerMonth, 0, 4) * 0.3 +
      normalize(totalCommsPerWeek, 0, 10) * 0.2,
  );

  // Extraversion: communication frequency, message volume, meeting count
  const extraversion = clamp(
    normalize(inboundPerWeek, 0, 5) * 0.4 +
      normalize(meetingsPerMonth, 0, 4) * 0.3 +
      normalize(totalCommsPerWeek, 0, 10) * 0.3,
  );

  // Agreeableness: low negotiation pushback, fast stage progression, cooperative signals
  const agreeableness = clamp(
    normalize(10 - stageChanges, 0, 10) * 0.4 +
      normalize(48 - avgResponseHours, 0, 48) * 0.3 +
      (closedLost.some((o) => o.lossReason === "PRICE") ? 20 : 60) * 0.3,
  );

  // Neuroticism: deal urgency reactions, frequent stage changes, short-deadline pressure
  const urgencySignals = opportunities.filter(
    (o) =>
      o.expectedCloseDate &&
      daysSince(o.expectedCloseDate) < 0 && // future close date
      Math.abs(daysSince(o.expectedCloseDate)) < 14, // within 2 weeks
  ).length;
  const neuroticism = clamp(
    normalize(stageChanges, 0, 15) * 0.3 +
      normalize(urgencySignals, 0, 5) * 0.3 +
      normalize(avgPriceSensitivity, 0, 100) * 0.4,
  );

  const bigFive: BigFive = {
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism,
  };

  // ── Jung Archetype ─────────────────────────────────────────────────────

  const jungArchetype = inferArchetype(bigFive, {
    autonomy: 0,
    competence: 0,
    relatedness: 0,
  });

  // ── Value Sensitivity (Zeithaml & Bitner) ──────────────────────────────

  const valueSensitivity: ValueSensitivity = {
    // Functional: price sensitivity, ROI focus
    functional: clamp(avgPriceSensitivity * 0.6 + conscientiousness * 0.4),
    // Emotional: relationship-driven, meeting-heavy
    emotional: clamp(extraversion * 0.5 + agreeableness * 0.5),
    // Social: collaborative, team-oriented (many attendees in meetings)
    social: clamp(extraversion * 0.4 + agreeableness * 0.3 + normalize(meetingsPerMonth, 0, 4) * 0.3),
    // Epistemic: curiosity, questions, exploration
    epistemic: clamp(openness * 0.7 + normalize(questionsPerMessage, 0, 3) * 0.3),
    // Conditional: urgency-driven, time-sensitive
    conditional: clamp(neuroticism * 0.4 + normalize(urgencySignals, 0, 5) * 0.6),
  };

  // ── Motivation Profile (SDT — Deci & Ryan) ────────────────────────────

  const motivationProfile: MotivationProfile = {
    // Autonomy: initiates contact, asks questions, drives process
    autonomy: clamp(
      normalize(inboundPerWeek, 0, 5) * 0.5 +
        openness * 0.3 +
        normalize(questionsPerMessage, 0, 3) * 0.2,
    ),
    // Competence: detail-oriented, thorough, conscientious
    competence: clamp(
      conscientiousness * 0.5 +
        normalize(questionsPerMessage, 0, 3) * 0.3 +
        normalize(meetingsPerMonth, 0, 4) * 0.2,
    ),
    // Relatedness: values connection, frequent meetings, social engagement
    relatedness: clamp(
      extraversion * 0.4 +
        agreeableness * 0.3 +
        normalize(meetingsPerMonth, 0, 4) * 0.3,
    ),
  };

  // Recalculate archetype with motivation data
  const finalArchetype = inferArchetype(bigFive, motivationProfile);

  // ── Conditioning Profile ───────────────────────────────────────────────

  const conditioningProfile: ConditioningProfile = {
    // Reward sensitivity: responds to positive signals (fast stage progression when good news)
    rewardSensitivity: clamp(
      extraversion * 0.3 +
        normalize(inboundPerWeek, 0, 5) * 0.4 +
        openness * 0.3,
    ),
    // Loss aversion: price sensitivity + urgency + negotiation behavior
    lossAversion: clamp(
      avgPriceSensitivity * 0.4 +
        neuroticism * 0.3 +
        normalize(stageChanges, 0, 10) * 0.3,
    ),
    // Habituation rate: consistency of engagement over time (drops off = high habituation)
    habituationRate: calculateHabituationRate(activities, since),
  };

  // ── FOMAP Score (BJ Fogg: B = M x A x P) ──────────────────────────────

  const motivation =
    (motivationProfile.autonomy +
      motivationProfile.competence +
      motivationProfile.relatedness) /
    3;
  const ability = clamp(
    normalize(48 - avgResponseHours, 0, 48) * 0.5 +
      normalize(meetingsPerMonth, 0, 4) * 0.5,
  );
  const prompt = clamp(
    normalize(totalCommsPerWeek, 0, 10) * 0.5 +
      normalize(inboundPerWeek, 0, 5) * 0.5,
  );
  const fomapScore = clamp((motivation * ability * prompt) / 10000 * 100);

  // ── Confidence ─────────────────────────────────────────────────────────

  const dataPoints = totalInbound + totalOutbound + meetingCount + opportunities.length;
  const confidence = Math.min(1, dataPoints / 50); // 50 data points = full confidence

  // ── Lifestyle (inferred from available signals) ────────────────────────

  const lifestyle: Lifestyle = {
    interests: inferInterests(activities, inboxMessages, meetings),
    values: inferValues(bigFive, valueSensitivity),
    priorities: inferPriorities(valueSensitivity, motivationProfile),
  };

  return {
    bigFive,
    jungArchetype: finalArchetype,
    lifestyle,
    valueSensitivity,
    motivationProfile,
    conditioningProfile,
    fomapScore,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Core: Match to ICP
// ---------------------------------------------------------------------------

/**
 * Score how well a CustomerProfile matches an ICPProfile template.
 * Returns 0-100 with per-dimension breakdown.
 */
export async function matchToICP(
  profileId: string,
  icpId: string,
): Promise<ProfileMatchResult> {
  const [profile, icp] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { id: profileId } }),
    prisma.iCPProfile.findUnique({ where: { id: icpId } }),
  ]);

  if (!profile || !icp) {
    return {
      score: 0,
      dimensionScores: {
        bigFive: 0,
        valueSensitivity: 0,
        motivation: 0,
        conditioning: 0,
        archetype: 0,
      },
      signals: [!profile ? "Perfil do contato nao encontrado" : "Perfil ICP nao encontrado"],
      matchedAt: new Date().toISOString(),
    };
  }

  const signals: string[] = [];

  // Parse ICP psychographic targets
  const icpBigFive = parseSafe<Partial<BigFive>>(icp.bigFiveProfile);
  const icpMotivation = parseSafe<Partial<MotivationProfile>>(icp.motivationProfile);
  const profileBigFive = profile.bigFive as BigFive | null;
  const profileValueSensitivity = profile.valueSensitivity as ValueSensitivity | null;
  const profileMotivation = profile.motivationProfile as MotivationProfile | null;
  const profileConditioning = profile.conditioningProfile as ConditioningProfile | null;

  // Big Five match
  let bigFiveScore = 50;
  if (profileBigFive && icpBigFive) {
    const dimensions: (keyof BigFive)[] = [
      "openness",
      "conscientiousness",
      "extraversion",
      "agreeableness",
      "neuroticism",
    ];
    let totalDiff = 0;
    let counted = 0;
    for (const dim of dimensions) {
      if (icpBigFive[dim] != null && profileBigFive[dim] != null) {
        // ICP stores 0-10 scale, profile stores 0-100
        const icpValue = (icpBigFive[dim]! / 10) * 100;
        totalDiff += Math.abs(profileBigFive[dim] - icpValue);
        counted++;
      }
    }
    if (counted > 0) {
      bigFiveScore = clamp(100 - (totalDiff / counted));
      if (bigFiveScore >= 70) signals.push("Personalidade alinhada ao ICP");
      else if (bigFiveScore < 40) signals.push("Personalidade diverge do ICP");
    }
  }

  // Value sensitivity match (compare against ICP value drivers)
  let valueSensitivityScore = 50;
  if (profileValueSensitivity && icp.valueDrivers) {
    const drivers = parseSafe<string[]>(icp.valueDrivers) ?? [];
    const driverMap: Record<string, keyof ValueSensitivity> = {
      ROI: "functional",
      PRICE: "functional",
      RELATIONSHIP: "emotional",
      BRAND: "social",
      INNOVATION: "epistemic",
      TIME_TO_VALUE: "conditional",
      INTEGRATION: "functional",
    };
    let matchSum = 0;
    let matchCount = 0;
    for (const driver of drivers) {
      const dim = driverMap[driver];
      if (dim && profileValueSensitivity[dim] != null) {
        matchSum += profileValueSensitivity[dim];
        matchCount++;
      }
    }
    if (matchCount > 0) {
      valueSensitivityScore = clamp(matchSum / matchCount);
      if (valueSensitivityScore >= 60) signals.push("Sensibilidade de valor compativel");
    }
  }

  // Motivation match
  let motivationScore = 50;
  if (profileMotivation && icpMotivation) {
    const dims: (keyof MotivationProfile)[] = ["autonomy", "competence", "relatedness"];
    let totalDiff = 0;
    let counted = 0;
    for (const dim of dims) {
      if (icpMotivation[dim] != null && profileMotivation[dim] != null) {
        totalDiff += Math.abs(profileMotivation[dim] - icpMotivation[dim]!);
        counted++;
      }
    }
    if (counted > 0) {
      motivationScore = clamp(100 - (totalDiff / counted));
      if (motivationScore >= 70) signals.push("Motivacao alinhada ao ICP");
    }
  }

  // Conditioning match (no direct ICP target — use risk tolerance as proxy)
  let conditioningScore = 50;
  if (profileConditioning && icp.riskTolerance) {
    const riskMap: Record<string, number> = { LOW: 30, MEDIUM: 50, HIGH: 70 };
    const targetLossAversion = 100 - (riskMap[icp.riskTolerance] ?? 50);
    const diff = Math.abs(profileConditioning.lossAversion - targetLossAversion);
    conditioningScore = clamp(100 - diff);
    if (conditioningScore >= 60) signals.push("Perfil de risco compativel");
  }

  // Archetype match
  let archetypeScore = 50;
  if (profile.jungArchetype && icp.decisionStyle) {
    const styleArchetypeMap: Record<string, JungArchetype[]> = {
      ANALYTICAL: ["sage", "ruler"],
      INTUITIVE: ["explorer", "magician"],
      CONSENSUS: ["caregiver", "lover"],
      AUTHORITATIVE: ["hero", "rebel"],
    };
    const matchingArchetypes = styleArchetypeMap[icp.decisionStyle] ?? [];
    if (matchingArchetypes.includes(profile.jungArchetype as JungArchetype)) {
      archetypeScore = 85;
      signals.push("Arquetipo compativel com estilo de decisao");
    } else {
      archetypeScore = 35;
    }
  }

  // Weighted overall
  const score = clamp(
    bigFiveScore * 0.25 +
      valueSensitivityScore * 0.25 +
      motivationScore * 0.2 +
      conditioningScore * 0.15 +
      archetypeScore * 0.15,
  );

  return {
    score,
    dimensionScores: {
      bigFive: bigFiveScore,
      valueSensitivity: valueSensitivityScore,
      motivation: motivationScore,
      conditioning: conditioningScore,
      archetype: archetypeScore,
    },
    signals,
    matchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Core: Update Profile from Deal Outcome (feedback loop)
// ---------------------------------------------------------------------------

/**
 * Adjust profile confidence and dimensions based on deal outcome.
 * Won deals reinforce the profile; lost deals reduce confidence.
 */
export async function updateProfileFromDealOutcome(
  contactId: string,
  organizationId: string,
  dealWon: boolean,
): Promise<void> {
  const existing = await prisma.customerProfile.findUnique({
    where: { contactId_organizationId: { contactId, organizationId } },
  });

  if (!existing) {
    // No profile yet — infer one
    const inferred = await inferProfile(contactId, organizationId);
    await prisma.customerProfile.create({
      data: {
        contactId,
        organizationId,
        bigFive: inferred.bigFive as any,
        jungArchetype: inferred.jungArchetype,
        lifestyle: inferred.lifestyle as any,
        valueSensitivity: inferred.valueSensitivity as any,
        motivationProfile: inferred.motivationProfile as any,
        conditioningProfile: inferred.conditioningProfile as any,
        fomapScore: inferred.fomapScore,
        confidence: dealWon ? 0.6 : 0.3,
        lastUpdatedAt: new Date(),
      },
    });
    return;
  }

  // Adjust confidence based on outcome
  const currentConfidence = existing.confidence ?? 0;
  let newConfidence: number;

  if (dealWon) {
    // Won deal: profile was accurate, boost confidence
    newConfidence = Math.min(1, currentConfidence + 0.1);
  } else {
    // Lost deal: profile may be inaccurate, reduce confidence
    newConfidence = Math.max(0, currentConfidence - 0.15);
  }

  // Re-infer profile with fresh data and blend with existing
  const freshProfile = await inferProfile(contactId, organizationId);
  const blendWeight = dealWon ? 0.3 : 0.6; // lost deals cause bigger profile update

  const blendedBigFive = blendDimensions(
    existing.bigFive as Record<string, number> | null,
    freshProfile.bigFive as unknown as Record<string, number>,
    blendWeight,
  );

  await prisma.customerProfile.update({
    where: { id: existing.id },
    data: {
      bigFive: blendedBigFive as any,
      jungArchetype: freshProfile.jungArchetype,
      lifestyle: freshProfile.lifestyle as any,
      valueSensitivity: blendDimensions(
        existing.valueSensitivity as Record<string, number> | null,
        freshProfile.valueSensitivity as unknown as Record<string, number>,
        blendWeight,
      ) as any,
      motivationProfile: blendDimensions(
        existing.motivationProfile as Record<string, number> | null,
        freshProfile.motivationProfile as unknown as Record<string, number>,
        blendWeight,
      ) as any,
      conditioningProfile: blendDimensions(
        existing.conditioningProfile as Record<string, number> | null,
        freshProfile.conditioningProfile as unknown as Record<string, number>,
        blendWeight,
      ) as any,
      fomapScore: freshProfile.fomapScore,
      confidence: Math.round(newConfidence * 100) / 100,
      lastUpdatedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function inferArchetype(
  bigFive: BigFive,
  motivation: MotivationProfile,
): JungArchetype {
  const high = 60;
  const low = 40;

  if (bigFive.openness >= high && motivation.autonomy >= high) return "explorer";
  if (bigFive.openness >= high && motivation.competence >= high) return "sage";
  if (bigFive.extraversion >= high && bigFive.agreeableness >= high) return "caregiver";
  if (bigFive.extraversion >= high && bigFive.agreeableness < low) return "rebel";
  if (bigFive.conscientiousness >= high && motivation.competence >= high) return "ruler";
  if (bigFive.neuroticism >= high && motivation.relatedness >= high) return "lover";
  if (bigFive.neuroticism < low && motivation.autonomy >= high) return "hero";

  return "magician";
}

function calculateHabituationRate(
  activities: Array<{ createdAt: Date }>,
  since: Date,
): number {
  if (activities.length < 4) return 50;

  // Split into first half and second half of the window
  const midpoint = new Date(since.getTime() + LOOKBACK_MS / 2);
  const firstHalf = activities.filter((a) => a.createdAt < midpoint).length;
  const secondHalf = activities.filter((a) => a.createdAt >= midpoint).length;

  if (firstHalf === 0) return 30; // all recent = low habituation
  const ratio = secondHalf / firstHalf;

  // ratio < 1 means engagement dropped (high habituation)
  // ratio > 1 means engagement grew (low habituation)
  return clamp(100 - ratio * 50);
}

function inferInterests(
  activities: Array<{ type: string; subject?: string | null }>,
  messages: Array<{ subject?: string | null }>,
  meetings: Array<{ title: string | null }>,
): string[] {
  const interests: Set<string> = new Set();

  const allText = [
    ...activities.map((a) => a.subject ?? ""),
    ...messages.map((m) => m.subject ?? ""),
    ...meetings.map((m) => m.title ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  const keywordMap: Record<string, string> = {
    preco: "preco",
    price: "preco",
    roi: "retorno_financeiro",
    retorno: "retorno_financeiro",
    demo: "demonstracao_produto",
    integracao: "integracao_tecnica",
    integration: "integracao_tecnica",
    suporte: "suporte",
    support: "suporte",
    timeline: "cronograma",
    prazo: "cronograma",
    seguranca: "seguranca",
    security: "seguranca",
    compliance: "compliance",
    escala: "escalabilidade",
    scale: "escalabilidade",
  };

  for (const [keyword, interest] of Object.entries(keywordMap)) {
    if (allText.includes(keyword)) interests.add(interest);
  }

  return Array.from(interests);
}

function inferValues(bigFive: BigFive, valueSens: ValueSensitivity): string[] {
  const values: string[] = [];

  if (bigFive.conscientiousness >= 60) values.push("organizacao");
  if (bigFive.openness >= 60) values.push("inovacao");
  if (bigFive.agreeableness >= 60) values.push("colaboracao");
  if (bigFive.extraversion >= 60) values.push("comunicacao");
  if (valueSens.functional >= 60) values.push("eficiencia");
  if (valueSens.epistemic >= 60) values.push("conhecimento");
  if (valueSens.social >= 60) values.push("relacionamento");

  return values.length > 0 ? values : ["equilibrio"];
}

function inferPriorities(
  valueSens: ValueSensitivity,
  motivation: MotivationProfile,
): string[] {
  const scored: Array<{ label: string; score: number }> = [
    { label: "custo_beneficio", score: valueSens.functional },
    { label: "experiencia", score: valueSens.emotional },
    { label: "reputacao", score: valueSens.social },
    { label: "aprendizado", score: valueSens.epistemic },
    { label: "velocidade", score: valueSens.conditional },
    { label: "independencia", score: motivation.autonomy },
    { label: "excelencia", score: motivation.competence },
    { label: "conexao", score: motivation.relatedness },
  ];

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.label);
}

function parseSafe<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function blendDimensions<T extends Record<string, number>>(
  existing: T | null,
  fresh: T,
  weight: number,
): T {
  if (!existing) return fresh;

  const result = { ...fresh };
  for (const key of Object.keys(fresh) as Array<keyof T>) {
    const oldVal = (existing[key] as number) ?? (fresh[key] as number);
    const newVal = fresh[key] as number;
    (result as any)[key] = clamp(oldVal * (1 - weight) + newVal * weight);
  }
  return result;
}
