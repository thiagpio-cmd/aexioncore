/**
 * OpenAI Task Provider
 *
 * Lightweight wrapper around OpenAI Chat Completions API
 * with the same task-specific methods as GeminiProvider.
 * Uses gpt-4o-mini for cost efficiency.
 */

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices?: Array<{ message: { content: string }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  error?: { message: string; type: string; code: string };
}

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

export class OpenAITaskProvider {
  readonly name = "openai";
  readonly displayName = "OpenAI GPT-4o Mini";

  isConfigured(): boolean {
    return !!getApiKey();
  }

  private async chat(
    messages: ChatMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();

    if (data.error) {
      throw new Error(`OpenAI error: ${data.error.message}`);
    }

    const text = data.choices?.[0]?.message?.content ?? "";
    const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);
    return { text, tokensUsed };
  }

  async generateText(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number; systemInstruction?: string }
  ): Promise<{ text: string; tokensUsed: number }> {
    const messages: ChatMessage[] = [];
    if (options?.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    messages.push({ role: "user", content: prompt });
    return this.chat(messages, options);
  }

  // ─── Task-Specific Methods ──────────────────────────────────────────

  async synthesizeExecutive(data: {
    pipeline: { totalValue: number; dealCount: number; winRate: number };
    leads: { total: number; conversionRate: number; hotCount: number };
    alerts: { critical: number; warning: number };
    period: string;
  }): Promise<string> {
    const result = await this.generateText(
      `You are a senior revenue operations analyst. Provide a concise 3-paragraph executive synthesis based on these metrics:

Pipeline: ${data.pipeline.dealCount} deals worth $${data.pipeline.totalValue.toLocaleString()}, win rate ${data.pipeline.winRate}%.
Leads: ${data.leads.total} total, ${data.leads.conversionRate}% conversion, ${data.leads.hotCount} hot leads.
Alerts: ${data.alerts.critical} critical, ${data.alerts.warning} warnings.
Period: ${data.period}.

Focus on:
1. Key strengths and risks
2. Actionable insights (not generic advice)
3. One specific recommendation with expected impact

Write in professional English. Be direct. No filler.`,
      {
        systemInstruction: "You are a revenue operations analyst at a B2B SaaS company. Be analytical, specific, and actionable.",
        maxTokens: 512,
        temperature: 0.3,
      }
    );
    return result.text;
  }

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
    const result = await this.generateText(
      `Classify this email for CRM relevance. Return JSON only, no markdown.

Subject: ${content.subject}
From: ${content.sender}
Body: ${content.body.substring(0, 500)}

Return exactly: {"category": "DEAL_RELATED|SUPPORT|MARKETING|PERSONAL|MEETING_REQUEST|FOLLOW_UP|INQUIRY|UNKNOWN", "relevance": "HIGH|MEDIUM|LOW|NONE", "sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "confidence": 0.0-1.0}`,
      { temperature: 0.1, maxTokens: 128 }
    );

    try {
      const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { category: "UNKNOWN", relevance: "LOW", sentiment: "NEUTRAL", confidence: 0.3 };
    }
  }

  async classifyObjections(objections: string[]): Promise<{
    clusters: { category: string; count: number; examples: string[] }[];
  }> {
    if (objections.length === 0) return { clusters: [] };

    const result = await this.generateText(
      `Classify these sales objections into standard categories. Return JSON only, no markdown.

Objections:
${objections.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Return format: {"clusters": [{"category": "PRICE", "count": N, "examples": ["..."]}]}
Standard categories: PRICE, TIMING, COMPETITOR, FEATURE_GAP, TRUST, AUTHORITY, BUDGET, NEED, TECHNICAL, OTHER`,
      { temperature: 0.1, maxTokens: 512 }
    );

    try {
      const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { clusters: [{ category: "UNCLASSIFIED", count: objections.length, examples: objections.slice(0, 3) }] };
    }
  }

  async generateContextualReply(
    channel: string,
    category: string,
    sentiment: string,
    subject?: string
  ): Promise<string> {
    const result = await this.generateText(
      `Generate a brief, professional reply for a ${channel} message.
Category: ${category}
Sentiment: ${sentiment}
Subject: ${subject || "No subject"}

Requirements:
- Keep it under 2 sentences
- Be professional but warm
- Include a clear next action
- Match the tone of the channel (formal for email, casual for WhatsApp)`,
      {
        maxTokens: 128,
        temperature: 0.4,
        systemInstruction: "You are a senior sales professional writing quick responses. Be concise and action-oriented.",
      }
    );
    return result.text;
  }

  async generateLeadInsight(data: {
    name: string;
    company: string;
    title: string;
    status: string;
    temperature: string;
    fitScore: number;
    source: string;
    daysSinceCreation: number;
    daysSinceContact: number | null;
    activityCount: number;
    taskCount: number;
    overdueTasks: number;
  }): Promise<string> {
    const result = await this.generateText(
      `You are a senior sales operations analyst. Provide a 2-3 sentence strategic insight for this lead.

Lead: ${data.name}
Company: ${data.company}
Title: ${data.title}
Status: ${data.status}
Temperature: ${data.temperature}
Fit Score: ${data.fitScore}/100
Source: ${data.source}
Days since creation: ${data.daysSinceCreation}
Days since last contact: ${data.daysSinceContact ?? "Never contacted"}
Activities logged: ${data.activityCount}
Tasks: ${data.taskCount} (${data.overdueTasks} overdue)

Focus on: What is the single most impactful action the rep should take RIGHT NOW, and why?
Be specific and actionable. No generic advice.`,
      {
        maxTokens: 256,
        temperature: 0.3,
        systemInstruction: "You are a revenue operations analyst. Be direct, specific, and actionable. No filler.",
      }
    );
    return result.text;
  }
}

// Singleton
export const openaiTaskProvider = new OpenAITaskProvider();
