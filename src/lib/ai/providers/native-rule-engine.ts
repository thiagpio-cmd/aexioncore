/**
 * Native Rule Engine
 *
 * Built-in AI provider that runs entirely locally — no external API calls.
 * Uses deterministic rules, keyword matching, and regex patterns to handle
 * all AI task types with predictable, explainable results.
 *
 * Confidence ranges:
 * - Rule-based tasks (score, recommend, classify): 0.80-0.95
 * - Text analysis tasks (summarize, extractEntities): 0.30-0.50
 */

import {
  BaseAIProvider,
  type AIContext,
  type AIResult,
  type AITaskType,
} from "../ai-provider-contract";

// ─── Scoring Weights ────────────────────────────────────────────────────────

const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 30,
  PARTNER: 25,
  WEBSITE: 20,
  WEBINAR: 20,
  EVENT: 18,
  CONTENT: 15,
  SOCIAL: 12,
  COLD_OUTBOUND: 10,
  PAID_AD: 10,
  web: 20,
  referral: 30,
  linkedin: 15,
  conference: 18,
  other: 5,
};

const TITLE_SCORES: Record<string, number> = {
  CEO: 25,
  CTO: 25,
  CFO: 25,
  COO: 25,
  CRO: 25,
  CMO: 25,
  "C-LEVEL": 25,
  FOUNDER: 25,
  "CO-FOUNDER": 25,
  PRESIDENT: 22,
  VP: 20,
  "VICE PRESIDENT": 20,
  SVP: 22,
  EVP: 22,
  DIRECTOR: 15,
  "SENIOR DIRECTOR": 18,
  HEAD: 15,
  MANAGER: 10,
  "SENIOR MANAGER": 12,
};

const STAGE_WEIGHTS: Record<string, number> = {
  discovery: 10,
  qualification: 20,
  proposal: 40,
  negotiation: 60,
  "verbal-commit": 80,
  "closed-won": 100,
  "closed-lost": 0,
};

const COMPANY_SIZE_SCORES: Record<string, number> = {
  enterprise: 20,
  "1000+": 20,
  "500-999": 15,
  "250-499": 12,
  "100-249": 10,
  "50-99": 8,
  mid_market: 12,
  smb: 5,
  startup: 3,
};

// ─── Sentiment Lexicon ──────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "fantastic",
  "love",
  "happy",
  "satisfied",
  "pleased",
  "impressed",
  "perfect",
  "awesome",
  "thrilled",
  "delighted",
  "outstanding",
  "superb",
  "brilliant",
  "good",
  "nice",
  "thanks",
  "thank",
  "appreciate",
  "helpful",
  "useful",
  "enjoy",
  "recommend",
  "excited",
  "interested",
  "opportunity",
  "agree",
  "yes",
  "sure",
  "absolutely",
  "definitely",
  "forward",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "terrible",
  "awful",
  "horrible",
  "hate",
  "disappointed",
  "frustrated",
  "angry",
  "poor",
  "worst",
  "unacceptable",
  "issue",
  "problem",
  "bug",
  "broken",
  "failed",
  "error",
  "wrong",
  "complaint",
  "unhappy",
  "unsatisfied",
  "cancel",
  "refund",
  "delay",
  "slow",
  "expensive",
  "overpriced",
  "unfortunately",
  "concern",
  "worried",
  "difficult",
  "confused",
  "annoying",
  "useless",
]);

// ─── Classification Keywords ────────────────────────────────────────────────

const CLASSIFICATION_KEYWORDS: Record<string, string[]> = {
  inquiry: [
    "question",
    "wondering",
    "curious",
    "how",
    "what",
    "when",
    "where",
    "who",
    "can you",
    "could you",
    "information",
    "details",
    "learn more",
    "tell me",
    "interested in",
  ],
  complaint: [
    "complaint",
    "issue",
    "problem",
    "not working",
    "broken",
    "disappointed",
    "unacceptable",
    "frustrated",
    "angry",
    "refund",
    "cancel",
  ],
  "follow-up": [
    "following up",
    "follow up",
    "checking in",
    "just wanted to",
    "touching base",
    "circling back",
    "as discussed",
    "per our",
    "recap",
  ],
  "meeting-request": [
    "schedule",
    "meeting",
    "call",
    "demo",
    "calendar",
    "available",
    "slot",
    "book",
    "time to chat",
    "catch up",
    "sync",
    "discuss",
  ],
  "feature-request": [
    "feature",
    "enhancement",
    "suggestion",
    "would be nice",
    "it would be great",
    "could you add",
    "request",
    "wish",
    "improvement",
  ],
  pricing: [
    "price",
    "pricing",
    "cost",
    "quote",
    "budget",
    "discount",
    "plan",
    "subscription",
    "billing",
    "invoice",
    "payment",
  ],
  partnership: [
    "partner",
    "partnership",
    "collaborate",
    "collaboration",
    "integrate",
    "integration",
    "alliance",
    "joint",
    "together",
  ],
  support: [
    "help",
    "support",
    "assist",
    "troubleshoot",
    "fix",
    "resolve",
    "technical",
    "not able to",
    "cannot",
    "error",
    "stuck",
  ],
};

// ─── Provider Implementation ────────────────────────────────────────────────

export class NativeRuleEngine extends BaseAIProvider {
  readonly key = "native-rule-engine";
  readonly name = "Native Rule Engine";
  readonly supportedTasks: AITaskType[] = [
    "score",
    "recommend",
    "classify",
    "analyze_sentiment",
    "summarize",
    "extract_entities",
    "next_best_action",
  ];
  readonly isNative = true;

  // ── Score ───────────────────────────────────────────────────────────────

  async score(context: AIContext): Promise<AIResult> {
    const start = Date.now();
    const data = context.data;
    const entityType = context.entityType.toLowerCase();

    let score = 0;
    const breakdown: string[] = [];

    if (entityType === "lead") {
      // Source scoring
      const source = String(data.source ?? "").toUpperCase();
      const sourceScore = SOURCE_SCORES[source] ?? SOURCE_SCORES[String(data.source ?? "")] ?? 5;
      score += sourceScore;
      breakdown.push(`source=${source}(+${sourceScore})`);

      // Title scoring
      const title = String(data.title ?? "").toUpperCase();
      let titleScore = 0;
      for (const [keyword, points] of Object.entries(TITLE_SCORES)) {
        if (title.includes(keyword)) {
          titleScore = Math.max(titleScore, points);
        }
      }
      if (titleScore > 0) {
        score += titleScore;
        breakdown.push(`title=${title}(+${titleScore})`);
      }

      // Company size hints
      const companySize = String(data.companySize ?? data.size ?? "").toLowerCase();
      const sizeScore = COMPANY_SIZE_SCORES[companySize] ?? 0;
      if (sizeScore > 0) {
        score += sizeScore;
        breakdown.push(`companySize=${companySize}(+${sizeScore})`);
      }

      // Engagement recency
      const lastContact = data.lastContact
        ? new Date(String(data.lastContact))
        : null;
      if (lastContact) {
        const daysSinceContact = Math.floor(
          (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact <= 1) {
          score += 15;
          breakdown.push(`recentActivity=today(+15)`);
        } else if (daysSinceContact <= 3) {
          score += 12;
          breakdown.push(`recentActivity=${daysSinceContact}d(+12)`);
        } else if (daysSinceContact <= 7) {
          score += 8;
          breakdown.push(`recentActivity=${daysSinceContact}d(+8)`);
        } else if (daysSinceContact <= 14) {
          score += 4;
          breakdown.push(`recentActivity=${daysSinceContact}d(+4)`);
        } else {
          breakdown.push(`recentActivity=${daysSinceContact}d(+0, stale)`);
        }
      }

      // Fit score (if provided)
      const fitScore = Number(data.fitScore ?? 0);
      if (fitScore > 0) {
        const fitContribution = Math.min(fitScore, 20);
        score += fitContribution;
        breakdown.push(`fitScore=${fitScore}(+${fitContribution})`);
      }

      // Temperature bonus
      const temperature = String(data.temperature ?? "").toUpperCase();
      if (temperature === "HOT") {
        score += 10;
        breakdown.push(`temperature=HOT(+10)`);
      } else if (temperature === "WARM") {
        score += 5;
        breakdown.push(`temperature=WARM(+5)`);
      }
    } else if (entityType === "opportunity") {
      // Stage weight
      const stage = String(data.stage ?? "discovery").toLowerCase();
      const stageWeight = STAGE_WEIGHTS[stage] ?? 10;
      score += Math.round(stageWeight * 0.4);
      breakdown.push(`stage=${stage}(+${Math.round(stageWeight * 0.4)})`);

      // Deal value
      const value = Number(data.value ?? 0);
      if (value >= 100000) {
        score += 20;
        breakdown.push(`value=${value}(+20, enterprise)`);
      } else if (value >= 50000) {
        score += 15;
        breakdown.push(`value=${value}(+15, mid-market)`);
      } else if (value >= 10000) {
        score += 10;
        breakdown.push(`value=${value}(+10, standard)`);
      } else if (value > 0) {
        score += 5;
        breakdown.push(`value=${value}(+5, small)`);
      }

      // Days in stage (staleness penalty)
      const updatedAt = data.updatedAt
        ? new Date(String(data.updatedAt))
        : null;
      if (updatedAt) {
        const daysInStage = Math.floor(
          (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysInStage > 30) {
          score -= 15;
          breakdown.push(`staleStage=${daysInStage}d(-15)`);
        } else if (daysInStage > 14) {
          score -= 8;
          breakdown.push(`staleStage=${daysInStage}d(-8)`);
        } else if (daysInStage > 7) {
          score -= 3;
          breakdown.push(`staleStage=${daysInStage}d(-3)`);
        }
      }

      // Probability bonus
      const probability = Number(data.probability ?? 0);
      if (probability > 0) {
        const probBonus = Math.round(probability * 0.2);
        score += probBonus;
        breakdown.push(`probability=${probability}%(+${probBonus})`);
      }

      // Activity recency
      const lastActivity = data.lastActivity
        ? new Date(String(data.lastActivity))
        : null;
      if (lastActivity) {
        const daysSince = Math.floor(
          (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince <= 3) {
          score += 10;
          breakdown.push(`activityRecency=${daysSince}d(+10)`);
        } else if (daysSince <= 7) {
          score += 5;
          breakdown.push(`activityRecency=${daysSince}d(+5)`);
        }
      }

      // Number of contacts (multi-threading bonus)
      const contactCount = Number(data.contactCount ?? data.contacts ?? 0);
      if (contactCount >= 3) {
        score += 10;
        breakdown.push(`multiThread=${contactCount}contacts(+10)`);
      } else if (contactCount >= 2) {
        score += 5;
        breakdown.push(`multiThread=${contactCount}contacts(+5)`);
      }
    } else {
      // Generic scoring — use whatever data is available
      score = 50;
      breakdown.push(`generic=baseScore(50)`);
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    const latencyMs = Date.now() - start;
    const reasoning = `${entityType} scored ${score}: ${breakdown.join(", ")}`;

    return {
      taskType: "score",
      provider: this.key,
      content: String(score),
      structured: { score, breakdown, entityType },
      confidence: 0.85,
      reasoning,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Recommend ───────────────────────────────────────────────────────────

  async recommend(context: AIContext): Promise<AIResult> {
    const start = Date.now();
    const data = context.data;
    const entityType = context.entityType.toLowerCase();
    const recommendations: Array<{
      action: string;
      reason: string;
      priority: string;
    }> = [];

    if (entityType === "lead") {
      const lastContact = data.lastContact
        ? new Date(String(data.lastContact))
        : null;
      const daysSinceContact = lastContact
        ? Math.floor(
            (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
          )
        : Infinity;
      const temperature = String(data.temperature ?? "").toUpperCase();
      const status = String(data.status ?? "").toUpperCase();
      const fitScore = Number(data.fitScore ?? 0);
      const title = String(data.title ?? "").toUpperCase();
      const source = String(data.source ?? "").toUpperCase();

      // No activity in 3+ days
      if (daysSinceContact > 3 && daysSinceContact < Infinity) {
        recommendations.push({
          action: "Follow up with this lead",
          reason: `No contact in ${daysSinceContact} days. Leads go cold quickly.`,
          priority: daysSinceContact > 7 ? "HIGH" : "MEDIUM",
        });
      }

      // Hot lead not converted
      if (temperature === "HOT" && status !== "CONVERTED" && status !== "QUALIFIED") {
        recommendations.push({
          action: "Convert this qualified lead",
          reason: "Lead is HOT but has not been converted to an opportunity yet.",
          priority: "HIGH",
        });
      }

      // Warm lead with no recent contact
      if (temperature === "WARM" && daysSinceContact > 5) {
        recommendations.push({
          action: "Re-engage this warm lead",
          reason: `Warm lead with no contact in ${daysSinceContact} days. Risk of cooling down.`,
          priority: "MEDIUM",
        });
      }

      // High fit score but cold temperature
      if (fitScore >= 70 && temperature === "COLD") {
        recommendations.push({
          action: "Nurture this high-fit lead",
          reason: `Fit score is ${fitScore} but temperature is cold. Start an engagement sequence.`,
          priority: "MEDIUM",
        });
      }

      // C-level or VP lead
      const isExecutive = ["CEO", "CTO", "CFO", "COO", "VP", "PRESIDENT", "FOUNDER"].some(
        (t) => title.includes(t)
      );
      if (isExecutive && daysSinceContact > 2) {
        recommendations.push({
          action: "Prioritize executive outreach",
          reason: `${data.title} is a senior contact. Executive leads need timely attention.`,
          priority: "HIGH",
        });
      }

      // Referral lead
      if (source === "REFERRAL" && daysSinceContact > 1) {
        recommendations.push({
          action: "Respond to referral lead quickly",
          reason: "Referral leads have the highest conversion rates. Respond within 24 hours.",
          priority: "HIGH",
        });
      }

      // New lead with no contact at all
      if (status === "NEW" && !lastContact) {
        recommendations.push({
          action: "Make initial contact with this new lead",
          reason: "New lead has never been contacted. First touch is critical.",
          priority: "HIGH",
        });
      }
    } else if (entityType === "opportunity") {
      const stage = String(data.stage ?? "").toLowerCase();
      const value = Number(data.value ?? 0);
      const updatedAt = data.updatedAt
        ? new Date(String(data.updatedAt))
        : null;
      const daysInStage = updatedAt
        ? Math.floor(
            (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;
      const contactCount = Number(data.contactCount ?? data.contacts ?? 0);
      const hasMeeting = Boolean(data.hasMeeting ?? data.meetingCount);

      // Proposal stage too long
      if (stage === "proposal" && daysInStage > 5) {
        recommendations.push({
          action: "Schedule decision meeting",
          reason: `Opportunity has been in proposal stage for ${daysInStage} days. Push for a decision.`,
          priority: "HIGH",
        });
      }

      // Discovery stage too long
      if (stage === "discovery" && daysInStage > 10) {
        recommendations.push({
          action: "Qualify or disqualify this opportunity",
          reason: `${daysInStage} days in discovery. Either move to qualification or close.`,
          priority: "MEDIUM",
        });
      }

      // Negotiation stage too long
      if (stage === "negotiation" && daysInStage > 7) {
        recommendations.push({
          action: "Escalate negotiation to close",
          reason: `${daysInStage} days in negotiation. Consider offering closing incentives.`,
          priority: "HIGH",
        });
      }

      // High-value deal without meeting
      if (value > 50000 && !hasMeeting) {
        recommendations.push({
          action: "Book executive meeting",
          reason: `Deal value is $${value.toLocaleString()} but no meeting scheduled. High-value deals need face time.`,
          priority: "HIGH",
        });
      }

      // Single-threaded deal
      if (contactCount <= 1 && stage !== "discovery") {
        recommendations.push({
          action: "Multi-thread this deal",
          reason: "Only one contact involved. Engage additional stakeholders to de-risk.",
          priority: "MEDIUM",
        });
      }

      // No probability set
      if (Number(data.probability ?? 0) === 0 && stage !== "discovery") {
        recommendations.push({
          action: "Update win probability",
          reason: "No win probability set. Accurate forecasting requires probability estimates.",
          priority: "LOW",
        });
      }
    } else if (entityType === "task") {
      const dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
      const status = String(data.status ?? "").toUpperCase();
      const taskName = String(data.title ?? data.name ?? "task");

      if (dueDate && dueDate.getTime() < Date.now() && status !== "COMPLETED" && status !== "DONE") {
        recommendations.push({
          action: `Complete overdue task: ${taskName}`,
          reason: `Task was due on ${dueDate.toISOString().split("T")[0]}. Overdue tasks signal disorganization.`,
          priority: "HIGH",
        });
      }
    }

    // Default recommendation if none generated
    if (recommendations.length === 0) {
      recommendations.push({
        action: "Review and update entity data",
        reason: "No specific action detected. Ensure all fields are up to date.",
        priority: "LOW",
      });
    }

    const latencyMs = Date.now() - start;
    const topRecommendation = recommendations[0];

    return {
      taskType: "recommend",
      provider: this.key,
      content: topRecommendation.action,
      structured: {
        recommendations,
        count: recommendations.length,
        entityType,
      },
      confidence: 0.9,
      reasoning: `Generated ${recommendations.length} recommendation(s) for ${entityType}. Top: "${topRecommendation.action}" — ${topRecommendation.reason}`,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Classify ────────────────────────────────────────────────────────────

  async classify(
    input: string,
    categories: string[],
    _context?: AIContext
  ): Promise<AIResult> {
    const start = Date.now();
    const lowerInput = input.toLowerCase();

    // If categories provided, use them. Otherwise use default classification keywords.
    const categoriesToCheck =
      categories.length > 0
        ? categories
        : Object.keys(CLASSIFICATION_KEYWORDS);

    const scores: Record<string, number> = {};
    let maxScore = 0;
    let bestCategory = categoriesToCheck[0] ?? "unknown";

    for (const category of categoriesToCheck) {
      const keywords =
        CLASSIFICATION_KEYWORDS[category.toLowerCase()] ??
        // Fallback: use the category itself as keyword
        [category.toLowerCase()];

      let catScore = 0;
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword)) {
          catScore += 1;
        }
      }

      scores[category] = catScore;
      if (catScore > maxScore) {
        maxScore = catScore;
        bestCategory = category;
      }
    }

    const totalKeywords = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence =
      totalKeywords > 0
        ? Math.min(0.95, 0.5 + (maxScore / totalKeywords) * 0.4)
        : 0.3;

    const latencyMs = Date.now() - start;

    return {
      taskType: "classify",
      provider: this.key,
      content: bestCategory,
      structured: { category: bestCategory, scores, allCategories: categoriesToCheck },
      confidence,
      reasoning: `Matched ${maxScore} keyword(s) for "${bestCategory}" out of ${totalKeywords} total matches across all categories.`,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Analyze (Sentiment) ─────────────────────────────────────────────────

  async analyze(context: AIContext): Promise<AIResult> {
    const start = Date.now();
    const text = String(
      context.data.text ?? context.data.body ?? context.data.content ?? ""
    );
    const words = text.toLowerCase().split(/\s+/);

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      // Strip punctuation for matching
      const clean = word.replace(/[^a-z]/g, "");
      if (POSITIVE_WORDS.has(clean)) positiveCount++;
      if (NEGATIVE_WORDS.has(clean)) negativeCount++;
    }

    const totalSignals = positiveCount + negativeCount;
    let sentiment: string;
    let sentimentScore: number; // -1 to 1

    if (totalSignals === 0) {
      sentiment = "neutral";
      sentimentScore = 0;
    } else {
      sentimentScore =
        (positiveCount - negativeCount) / totalSignals;
      if (sentimentScore > 0.2) {
        sentiment = "positive";
      } else if (sentimentScore < -0.2) {
        sentiment = "negative";
      } else {
        sentiment = "neutral";
      }
    }

    const confidence =
      totalSignals === 0
        ? 0.3
        : Math.min(0.85, 0.4 + totalSignals * 0.05);

    const latencyMs = Date.now() - start;

    return {
      taskType: "analyze_sentiment",
      provider: this.key,
      content: sentiment,
      structured: {
        sentiment,
        sentimentScore,
        positiveCount,
        negativeCount,
        totalWords: words.length,
      },
      confidence,
      reasoning: `Found ${positiveCount} positive and ${negativeCount} negative signals in ${words.length} words. Score: ${sentimentScore.toFixed(2)}.`,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Summarize ───────────────────────────────────────────────────────────

  async summarize(content: string, _context?: AIContext): Promise<AIResult> {
    const start = Date.now();

    // Split into sentences
    const sentences = content
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    // Take the first 2-3 meaningful sentences
    const summaryCount = Math.min(3, sentences.length);
    const summarySentences = sentences.slice(0, summaryCount);
    const summary =
      summarySentences.length > 0
        ? summarySentences.join(". ") + "."
        : content.slice(0, 200) + (content.length > 200 ? "..." : "");

    // Extract mentioned entities (basic keyword extraction)
    const entityMentions: string[] = [];
    const entityPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, // Proper nouns (multi-word)
      /\$[\d,]+(?:\.\d{2})?/g, // Money amounts
      /\b\d{1,3}(?:,\d{3})*\b/g, // Large numbers
    ];

    for (const pattern of entityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        entityMentions.push(...matches.slice(0, 5));
      }
    }

    const latencyMs = Date.now() - start;

    return {
      taskType: "summarize",
      provider: this.key,
      content: summary,
      structured: {
        summary,
        sentenceCount: sentences.length,
        summarySentenceCount: summaryCount,
        entityMentions: [...new Set(entityMentions)],
      },
      confidence: sentences.length > 3 ? 0.4 : 0.3,
      reasoning: `Extracted first ${summaryCount} of ${sentences.length} sentences. Native summarization is limited — an LLM provider would produce better results.`,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Extract Entities ────────────────────────────────────────────────────

  async extractEntities(text: string): Promise<AIResult> {
    const start = Date.now();

    const entities: Record<string, string[]> = {
      emails: [],
      phones: [],
      urls: [],
      money: [],
      dates: [],
      percentages: [],
      names: [],
    };

    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches) {
      entities.emails = [...new Set(emailMatches)];
    }

    // Phone number extraction
    const phoneRegex =
      /(?:\+?(\d{1,3}))?[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      entities.phones = [
        ...new Set(
          phoneMatches.filter((p) => p.replace(/\D/g, "").length >= 7)
        ),
      ];
    }

    // URL extraction
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const urlMatches = text.match(urlRegex);
    if (urlMatches) {
      entities.urls = [...new Set(urlMatches)];
    }

    // Monetary value extraction
    const moneyRegex =
      /(?:USD|EUR|BRL|GBP|R?\$)\s?[\d,.]+(?:\s?(?:million|billion|mil|bi|k|M|B))?|\b\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?\s?(?:dollars|euros|reais|USD|EUR|BRL)\b/gi;
    const moneyMatches = text.match(moneyRegex);
    if (moneyMatches) {
      entities.money = [...new Set(moneyMatches)];
    }

    // Date extraction
    const dateRegex =
      /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)\b/gi;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      entities.dates = [...new Set(dateMatches)];
    }

    // Percentage extraction
    const percentRegex = /\b\d+(?:\.\d+)?%/g;
    const percentMatches = text.match(percentRegex);
    if (percentMatches) {
      entities.percentages = [...new Set(percentMatches)];
    }

    // Proper name extraction (simple: multi-word capitalized phrases)
    const nameRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    const nameMatches = text.match(nameRegex);
    if (nameMatches) {
      entities.names = [...new Set(nameMatches)].slice(0, 10);
    }

    const totalFound = Object.values(entities).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    const latencyMs = Date.now() - start;

    return {
      taskType: "extract_entities",
      provider: this.key,
      content: `Found ${totalFound} entities`,
      structured: { entities, totalFound },
      confidence: totalFound > 0 ? 0.5 : 0.3,
      reasoning: `Regex-based extraction found ${totalFound} entities: ${Object.entries(entities)
        .filter(([, v]) => v.length > 0)
        .map(([k, v]) => `${v.length} ${k}`)
        .join(", ")}. An LLM would detect more nuanced entities.`,
      tokens: { input: 0, output: 0 },
      latencyMs,
      cached: false,
    };
  }

  // ── Healthcheck ─────────────────────────────────────────────────────────

  async healthcheck() {
    const start = Date.now();
    return {
      healthy: true,
      message: "Native Rule Engine is always available — no external dependencies.",
      latencyMs: Date.now() - start,
    };
  }

  // ── Cost Estimation ─────────────────────────────────────────────────────

  estimateCost(_taskType: AITaskType, _inputLength: number) {
    return { estimatedCost: 0, currency: "USD" };
  }
}
