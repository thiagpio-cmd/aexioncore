/**
 * AI Activity Processor
 *
 * Core autonomous engine that processes every communication (Activity or InboxMessage)
 * and determines CRM actions automatically.
 *
 * Provider cascade:
 * 1. OpenAI gpt-4o-mini (if OPENAI_API_KEY configured) — rich structured analysis
 * 2. Deterministic keyword analysis — always available, never fails
 *
 * Design principles:
 * - Never throw — always returns a ProcessingResult even if degraded
 * - Fast — OpenAI calls use gpt-4o-mini with low max_tokens
 * - Single prompt — one OpenAI call extracts everything at once
 */

import { openaiTaskProvider } from "./providers/openai-tasks";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProcessingResult {
  classification: {
    intent: string;
    confidence: number;
    subIntents: string[];
  };
  entities: {
    people: string[];
    dates: string[];
    amounts: number[];
    companies: string[];
    actionItems: string[];
  };
  sentiment: {
    score: number; // -1 to 1
    label: "positive" | "neutral" | "negative";
  };
  actions: AIAction[];
  summary: string;
  provider: string;
}

export interface AIAction {
  type:
    | "UPDATE_LEAD_STATUS"
    | "UPDATE_DEAL_STAGE"
    | "CREATE_TASK"
    | "FLAG_AT_RISK"
    | "LOG_SUMMARY"
    | "UPDATE_TEMPERATURE"
    | "SUGGEST_NEXT_ACTION";
  targetEntity: string; // 'lead' | 'opportunity' | 'task'
  targetId?: string;
  data: Record<string, any>;
  confidence: number;
  reasoning: string;
}

export interface ActivityInput {
  id: string;
  type: string;
  subject?: string | null;
  body?: string | null;
  channel?: string | null;
  direction?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  lead?: {
    id: string;
    name: string;
    status: string;
    temperature: string;
  } | null;
  opportunity?: {
    id: string;
    title: string;
    stage: string;
    value: number;
  } | null;
}

// ─── OpenAI Structured Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI CRM analyst. Given a communication (email, call note, message), you must analyze it and return a single JSON object with the following structure. Return ONLY valid JSON, no markdown fences.

{
  "classification": {
    "intent": "deal_progress|meeting_request|objection|follow_up|pricing_discussion|competitor_mention|decision_pending|churn_risk|positive_signal|negative_signal|general",
    "confidence": 0.0-1.0,
    "subIntents": ["array of secondary intents if any"]
  },
  "entities": {
    "people": ["names mentioned"],
    "dates": ["dates mentioned in ISO or natural form"],
    "amounts": [numeric values mentioned],
    "companies": ["company names mentioned"],
    "actionItems": ["action items extracted from the text"]
  },
  "sentiment": {
    "score": -1.0 to 1.0,
    "label": "positive|neutral|negative"
  },
  "suggestedActions": [
    {
      "type": "UPDATE_LEAD_STATUS|UPDATE_DEAL_STAGE|CREATE_TASK|FLAG_AT_RISK|LOG_SUMMARY|UPDATE_TEMPERATURE|SUGGEST_NEXT_ACTION",
      "targetEntity": "lead|opportunity|task",
      "data": {},
      "confidence": 0.0-1.0,
      "reasoning": "why this action"
    }
  ],
  "summary": "1-2 sentence summary of the communication"
}`;

function buildUserPrompt(input: ActivityInput): string {
  const parts: string[] = [];
  parts.push(`Type: ${input.type}`);
  if (input.channel) parts.push(`Channel: ${input.channel}`);
  if (input.direction) parts.push(`Direction: ${input.direction}`);
  if (input.subject) parts.push(`Subject: ${input.subject}`);
  if (input.body) parts.push(`Body: ${input.body.substring(0, 1500)}`);

  if (input.lead) {
    parts.push(`\nLinked Lead: ${input.lead.name} (status=${input.lead.status}, temperature=${input.lead.temperature})`);
  }
  if (input.opportunity) {
    parts.push(`Linked Opportunity: ${input.opportunity.title} (stage=${input.opportunity.stage}, value=${input.opportunity.value})`);
  }

  return parts.join("\n");
}

// ─── OpenAI Processing ──────────────────────────────────────────────────────

async function processWithOpenAI(input: ActivityInput): Promise<ProcessingResult | null> {
  if (!openaiTaskProvider.isConfigured()) return null;

  try {
    const result = await openaiTaskProvider.generateText(buildUserPrompt(input), {
      systemInstruction: SYSTEM_PROMPT,
      maxTokens: 768,
      temperature: 0.1,
    });

    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Map suggestedActions to AIAction[]
    const actions: AIAction[] = (parsed.suggestedActions ?? []).map((a: any) => ({
      type: a.type,
      targetEntity: a.targetEntity ?? "lead",
      targetId: input.leadId ?? input.opportunityId ?? undefined,
      data: a.data ?? {},
      confidence: a.confidence ?? 0.5,
      reasoning: a.reasoning ?? "",
    }));

    // Always add a LOG_SUMMARY action
    actions.push({
      type: "LOG_SUMMARY",
      targetEntity: input.leadId ? "lead" : input.opportunityId ? "opportunity" : "lead",
      targetId: input.leadId ?? input.opportunityId ?? undefined,
      data: { summary: parsed.summary ?? "" },
      confidence: 1,
      reasoning: "AI-generated summary for activity log",
    });

    return {
      classification: {
        intent: parsed.classification?.intent ?? "general",
        confidence: parsed.classification?.confidence ?? 0.5,
        subIntents: parsed.classification?.subIntents ?? [],
      },
      entities: {
        people: parsed.entities?.people ?? [],
        dates: parsed.entities?.dates ?? [],
        amounts: parsed.entities?.amounts ?? [],
        companies: parsed.entities?.companies ?? [],
        actionItems: parsed.entities?.actionItems ?? [],
      },
      sentiment: {
        score: parsed.sentiment?.score ?? 0,
        label: parsed.sentiment?.label ?? "neutral",
      },
      actions,
      summary: parsed.summary ?? "",
      provider: "openai",
    };
  } catch (err) {
    console.warn("[ActivityProcessor] OpenAI processing failed, falling back:", err);
    return null;
  }
}

// ─── Deterministic Processing ───────────────────────────────────────────────

const INTENT_KEYWORDS: Record<string, string[]> = {
  deal_progress: ["proposal", "contract", "agreement", "sign", "close", "deal", "moving forward", "next steps", "proceed", "approved"],
  meeting_request: ["schedule", "meeting", "call", "demo", "calendar", "available", "slot", "book", "discuss", "sync"],
  objection: ["concern", "worried", "hesitant", "not sure", "expensive", "too much", "competitor", "alternative", "issue with"],
  follow_up: ["following up", "follow up", "checking in", "touching base", "circling back", "as discussed", "recap", "per our"],
  pricing_discussion: ["price", "pricing", "cost", "quote", "budget", "discount", "subscription", "billing", "payment", "invoice"],
  competitor_mention: ["competitor", "alternative", "versus", "compared to", "instead of", "other option", "salesforce", "hubspot", "pipedrive"],
  decision_pending: ["decision", "deciding", "evaluate", "review", "consider", "think about", "get back to you", "internal discussion", "board"],
  churn_risk: ["cancel", "cancellation", "stop", "end", "terminate", "unhappy", "disappointed", "leaving", "switching", "not renewing"],
  positive_signal: ["love", "great", "excited", "interested", "ready", "let's go", "sign me up", "impressed", "perfect", "yes"],
  negative_signal: ["no", "not interested", "pass", "decline", "not a fit", "too expensive", "bad timing", "not now"],
};

const POSITIVE_WORDS = new Set([
  "great", "excellent", "amazing", "love", "happy", "satisfied", "impressed",
  "perfect", "awesome", "thrilled", "thanks", "appreciate", "excited",
  "interested", "agree", "yes", "absolutely", "definitely", "forward",
  "wonderful", "fantastic", "outstanding", "ready",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "hate", "disappointed", "frustrated", "angry",
  "poor", "issue", "problem", "broken", "failed", "wrong", "complaint",
  "unhappy", "cancel", "refund", "delay", "expensive", "concerned",
  "worried", "difficult", "confused", "annoying",
]);

function processWithDeterministic(input: ActivityInput): ProcessingResult {
  const text = `${input.subject ?? ""} ${input.body ?? ""}`.toLowerCase();
  const words = text.split(/\s+/);

  // --- Intent Classification ---
  let bestIntent = "general";
  let bestScore = 0;
  const subIntents: string[] = [];

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = keywords.filter((k) => text.includes(k)).length;
    if (matches > bestScore) {
      if (bestScore > 0) subIntents.push(bestIntent);
      bestScore = matches;
      bestIntent = intent;
    } else if (matches > 0) {
      subIntents.push(intent);
    }
  }

  const totalMatches = Object.values(INTENT_KEYWORDS)
    .flatMap((kws) => kws)
    .filter((k) => text.includes(k)).length;

  const intentConfidence = totalMatches > 0
    ? Math.min(0.85, 0.4 + (bestScore / totalMatches) * 0.4)
    : 0.3;

  // --- Entity Extraction ---
  const people: string[] = [];
  const nameRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const nameMatches = (input.body ?? "").match(nameRegex);
  if (nameMatches) people.push(...new Set(nameMatches));

  const dates: string[] = [];
  const dateRegex = /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?|(?:today|tomorrow|next week|next month|monday|tuesday|wednesday|thursday|friday))\b/gi;
  const dateMatches = (input.body ?? "").match(dateRegex);
  if (dateMatches) dates.push(...new Set(dateMatches));

  const amounts: number[] = [];
  const amountRegex = /(?:R?\$|USD|EUR)\s?([\d,.]+)/g;
  let amountMatch: RegExpExecArray | null;
  while ((amountMatch = amountRegex.exec(input.body ?? "")) !== null) {
    const val = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!isNaN(val)) amounts.push(val);
  }

  const companies: string[] = [];
  if (input.lead?.name) companies.push(input.lead.name);

  const actionItems: string[] = [];
  const actionPatterns = [
    /(?:need to|should|must|please|will|going to|let's)\s+([^.!?]+)/gi,
  ];
  for (const pattern of actionPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(input.body ?? "")) !== null) {
      const item = m[1].trim();
      if (item.length > 5 && item.length < 120) actionItems.push(item);
    }
  }

  // --- Sentiment Analysis ---
  let positiveCount = 0;
  let negativeCount = 0;
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (POSITIVE_WORDS.has(clean)) positiveCount++;
    if (NEGATIVE_WORDS.has(clean)) negativeCount++;
  }
  const totalSignals = positiveCount + negativeCount;
  const sentimentScore = totalSignals === 0
    ? 0
    : (positiveCount - negativeCount) / totalSignals;
  const sentimentLabel: "positive" | "neutral" | "negative" =
    sentimentScore > 0.2 ? "positive" : sentimentScore < -0.2 ? "negative" : "neutral";

  // --- Determine Actions ---
  const actions: AIAction[] = [];

  // Temperature update based on sentiment
  if (input.leadId && totalSignals > 0) {
    const newTemp =
      sentimentLabel === "positive" ? "WARM" :
      sentimentLabel === "negative" ? "COLD" : undefined;
    if (newTemp) {
      actions.push({
        type: "UPDATE_TEMPERATURE",
        targetEntity: "lead",
        targetId: input.leadId,
        data: { temperature: newTemp },
        confidence: Math.min(0.8, 0.4 + totalSignals * 0.05),
        reasoning: `Sentiment is ${sentimentLabel} (score=${sentimentScore.toFixed(2)}), adjusting lead temperature`,
      });
    }
  }

  // Positive signal on lead
  if (input.leadId && bestIntent === "positive_signal") {
    actions.push({
      type: "UPDATE_LEAD_STATUS",
      targetEntity: "lead",
      targetId: input.leadId,
      data: { status: "ENGAGED" },
      confidence: intentConfidence,
      reasoning: "Positive signal detected — lead is actively engaged",
    });
    actions.push({
      type: "UPDATE_TEMPERATURE",
      targetEntity: "lead",
      targetId: input.leadId,
      data: { temperature: "HOT" },
      confidence: intentConfidence,
      reasoning: "Strong positive signal warrants hot temperature",
    });
  }

  // Churn risk
  if (bestIntent === "churn_risk") {
    if (input.opportunityId) {
      actions.push({
        type: "FLAG_AT_RISK",
        targetEntity: "opportunity",
        targetId: input.opportunityId,
        data: { atRisk: true, reason: "Churn-related language detected" },
        confidence: intentConfidence,
        reasoning: "Churn risk keywords detected in communication",
      });
    }
    if (input.leadId) {
      actions.push({
        type: "UPDATE_TEMPERATURE",
        targetEntity: "lead",
        targetId: input.leadId,
        data: { temperature: "COLD" },
        confidence: intentConfidence,
        reasoning: "Churn risk signals suggest cooling lead temperature",
      });
    }
  }

  // Negative signal
  if (bestIntent === "negative_signal" && input.leadId) {
    actions.push({
      type: "UPDATE_LEAD_STATUS",
      targetEntity: "lead",
      targetId: input.leadId,
      data: { status: "UNRESPONSIVE" },
      confidence: intentConfidence,
      reasoning: "Negative signal detected — lead may be disengaging",
    });
  }

  // Deal progress
  if (bestIntent === "deal_progress" && input.opportunityId) {
    actions.push({
      type: "SUGGEST_NEXT_ACTION",
      targetEntity: "opportunity",
      targetId: input.opportunityId,
      data: { suggestion: "Deal is progressing. Review stage and consider advancing." },
      confidence: intentConfidence,
      reasoning: "Deal progress language detected",
    });
  }

  // Meeting request → create a task
  if (bestIntent === "meeting_request") {
    actions.push({
      type: "CREATE_TASK",
      targetEntity: input.leadId ? "lead" : "opportunity",
      targetId: input.leadId ?? input.opportunityId ?? undefined,
      data: {
        title: `Schedule meeting${input.subject ? `: ${input.subject}` : ""}`,
        type: "MEETING",
        priority: "HIGH",
      },
      confidence: intentConfidence,
      reasoning: "Meeting request detected — creating task to schedule",
    });
  }

  // Follow up → create a task
  if (bestIntent === "follow_up") {
    actions.push({
      type: "CREATE_TASK",
      targetEntity: input.leadId ? "lead" : "opportunity",
      targetId: input.leadId ?? input.opportunityId ?? undefined,
      data: {
        title: `Follow up${input.subject ? `: ${input.subject}` : ""}`,
        type: "FOLLOW_UP",
        priority: "MEDIUM",
      },
      confidence: intentConfidence,
      reasoning: "Follow-up intent detected — creating task",
    });
  }

  // Pricing discussion
  if (bestIntent === "pricing_discussion") {
    actions.push({
      type: "SUGGEST_NEXT_ACTION",
      targetEntity: input.opportunityId ? "opportunity" : "lead",
      targetId: input.opportunityId ?? input.leadId ?? undefined,
      data: { suggestion: "Pricing discussion detected. Prepare proposal or quote." },
      confidence: intentConfidence,
      reasoning: "Pricing-related keywords in communication",
    });
  }

  // Competitor mention
  if (bestIntent === "competitor_mention" && input.opportunityId) {
    actions.push({
      type: "FLAG_AT_RISK",
      targetEntity: "opportunity",
      targetId: input.opportunityId,
      data: { atRisk: true, reason: "Competitor mentioned in conversation" },
      confidence: intentConfidence,
      reasoning: "Competitor mention may signal evaluation against alternatives",
    });
  }

  // Always log summary
  const summaryText = text.length > 200 ? text.substring(0, 200) + "..." : text;
  actions.push({
    type: "LOG_SUMMARY",
    targetEntity: input.leadId ? "lead" : input.opportunityId ? "opportunity" : "lead",
    targetId: input.leadId ?? input.opportunityId ?? undefined,
    data: { summary: summaryText.trim() },
    confidence: 1,
    reasoning: "Deterministic summary of activity content",
  });

  return {
    classification: {
      intent: bestIntent,
      confidence: intentConfidence,
      subIntents: subIntents.slice(0, 3),
    },
    entities: {
      people: people.slice(0, 10),
      dates: dates.slice(0, 5),
      amounts: amounts.slice(0, 5),
      companies: companies.slice(0, 5),
      actionItems: actionItems.slice(0, 5),
    },
    sentiment: {
      score: sentimentScore,
      label: sentimentLabel,
    },
    actions,
    summary: summaryText.trim(),
    provider: "deterministic",
  };
}

// ─── Main Processor ─────────────────────────────────────────────────────────

export async function processActivity(input: ActivityInput): Promise<ProcessingResult> {
  // Try OpenAI first for rich analysis
  const openaiResult = await processWithOpenAI(input);
  if (openaiResult) {
    // Ensure targetIds are populated from input context
    for (const action of openaiResult.actions) {
      if (!action.targetId) {
        if (action.targetEntity === "lead" && input.leadId) {
          action.targetId = input.leadId;
        } else if (action.targetEntity === "opportunity" && input.opportunityId) {
          action.targetId = input.opportunityId;
        }
      }
    }
    return openaiResult;
  }

  // Deterministic fallback — always succeeds
  return processWithDeterministic(input);
}
