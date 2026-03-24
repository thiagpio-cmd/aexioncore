/**
 * Gemini Provider
 *
 * Integrates Google Gemini API for deeper analytical enrichment.
 * Uses the Gemini Developer API free tier.
 *
 * This provider enriches the existing deterministic engines — it does NOT
 * replace them. If Gemini is unavailable, the system falls back to the
 * NativeRuleEngine without degradation.
 *
 * Tasks:
 * - summarize: Executive synthesis from structured data
 * - classify: Message/objection classification
 * - extractEntities: Named entity extraction from text
 * - recommend: Context-aware recommendation enrichment
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";

interface GeminiResponse {
  candidates?: { content: { parts: { text: string }[] } }[];
  error?: { message: string; code: number };
}

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

export class GeminiProvider {
  readonly name = "gemini";
  readonly displayName = "Google Gemini";

  isConfigured(): boolean {
    return !!getApiKey();
  }

  async generateText(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
    systemInstruction?: string;
  }): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const model = DEFAULT_MODEL;
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.3,
      },
    };

    if (options?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(`Gemini API error (${data.error.code}): ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, tokensUsed: text.length }; // Approximate token count
  }

  // ─── Task-Specific Methods ──────────────────────────────────────────────

  /**
   * Generate a richer executive synthesis from structured report data.
   */
  async synthesizeExecutive(data: {
    pipeline: { totalValue: number; dealCount: number; winRate: number };
    leads: { total: number; conversionRate: number; hotCount: number };
    alerts: { critical: number; warning: number };
    period: string;
  }): Promise<string> {
    const prompt = `You are a senior revenue operations analyst. Provide a concise 3-paragraph executive synthesis based on these metrics:

Pipeline: ${data.pipeline.dealCount} deals worth $${data.pipeline.totalValue}, win rate ${data.pipeline.winRate}%.
Leads: ${data.leads.total} total, ${data.leads.conversionRate}% conversion, ${data.leads.hotCount} hot leads.
Alerts: ${data.alerts.critical} critical, ${data.alerts.warning} warnings.
Period: ${data.period}.

Focus on:
1. Key strengths and risks
2. Actionable insights (not generic advice)
3. One specific recommendation with expected impact

Write in professional English. Be direct. No filler.`;

    const result = await this.generateText(prompt, {
      systemInstruction: "You are a revenue operations analyst at a B2B SaaS company. Be analytical, specific, and actionable.",
      maxTokens: 512,
      temperature: 0.3,
    });

    return result.text;
  }

  /**
   * Normalize and cluster free-text objections into standard categories.
   */
  async classifyObjections(objections: string[]): Promise<{
    clusters: { category: string; count: number; examples: string[] }[];
  }> {
    if (objections.length === 0) return { clusters: [] };

    const prompt = `Classify these sales objections into standard categories. Return JSON only.

Objections:
${objections.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Return format: {"clusters": [{"category": "PRICE", "count": N, "examples": ["..."]}]}
Standard categories: PRICE, TIMING, COMPETITOR, FEATURE_GAP, TRUST, AUTHORITY, BUDGET, NEED, TECHNICAL, OTHER`;

    const result = await this.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 512,
    });

    try {
      const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { clusters: [{ category: "UNCLASSIFIED", count: objections.length, examples: objections.slice(0, 3) }] };
    }
  }

  /**
   * Classify an email/message for CRM relevance.
   */
  async classifyMessage(content: {
    subject: string;
    body: string;
    sender: string;
  }): Promise<{
    category: string;
    relevance: string;
    sentiment: string;
    confidence: number;
  }> {
    const prompt = `Classify this email for CRM relevance. Return JSON only.

Subject: ${content.subject}
From: ${content.sender}
Body: ${content.body.substring(0, 500)}

Return: {"category": "DEAL_RELATED|SUPPORT|MARKETING|PERSONAL|UNKNOWN", "relevance": "HIGH|MEDIUM|LOW|NONE", "sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "confidence": 0.0-1.0}`;

    const result = await this.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 128,
    });

    try {
      const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { category: "UNKNOWN", relevance: "LOW", sentiment: "NEUTRAL", confidence: 0.3 };
    }
  }
}

// Singleton
export const geminiProvider = new GeminiProvider();
