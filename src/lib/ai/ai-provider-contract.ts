/**
 * AI Provider Contract
 *
 * Every AI provider (native or external) MUST implement this interface.
 * Same philosophy as the integration provider-contract:
 * - Every method is self-contained
 * - Errors never bubble uncaught
 * - Results always include confidence, reasoning, and latency
 * - Source attribution is mandatory
 */

// ─── Task Types ─────────────────────────────────────────────────────────────

export type AITaskType =
  | "summarize"
  | "classify"
  | "score"
  | "recommend"
  | "analyze_sentiment"
  | "extract_entities"
  | "generate_text"
  | "next_best_action";

// ─── Context & Result ───────────────────────────────────────────────────────

export interface AIContext {
  entityType: string;
  entityId: string;
  organizationId: string;
  data: Record<string, unknown>;
  history?: Record<string, unknown>[];
}

export interface AIResult {
  taskType: AITaskType;
  provider: string;
  content: string;
  structured?: Record<string, unknown>;
  confidence: number; // 0-1
  reasoning?: string;
  tokens?: { input: number; output: number };
  latencyMs: number;
  cached?: boolean;
}

// ─── Provider Configuration ─────────────────────────────────────────────────

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
  timeout?: number;
  rateLimit?: { maxPerMinute: number; maxPerDay: number };
  budget?: { maxCostPerDay: number; currency: string };
}

// ─── Provider Interface ─────────────────────────────────────────────────────

/**
 * THE CONTRACT.
 * Every AI provider must implement this interface.
 */
export interface AIProvider {
  readonly key: string;
  readonly name: string;
  readonly supportedTasks: AITaskType[];
  readonly isNative: boolean; // true = no external API needed

  initialize(config: AIProviderConfig): void;

  analyze(context: AIContext): Promise<AIResult>;
  summarize(content: string, context?: AIContext): Promise<AIResult>;
  classify(
    input: string,
    categories: string[],
    context?: AIContext
  ): Promise<AIResult>;
  score(context: AIContext): Promise<AIResult>;
  recommend(context: AIContext): Promise<AIResult>;
  extractEntities(text: string): Promise<AIResult>;
  generateText(prompt: string, context?: AIContext): Promise<AIResult>;

  healthcheck(): Promise<{
    healthy: boolean;
    message: string;
    latencyMs: number;
  }>;

  estimateCost(
    taskType: AITaskType,
    inputLength: number
  ): { estimatedCost: number; currency: string };
}

// ─── Base Provider Class ────────────────────────────────────────────────────

/**
 * Abstract base class with sensible defaults for providers
 * that don't support all task types.
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly key: string;
  abstract readonly name: string;
  abstract readonly supportedTasks: AITaskType[];
  abstract readonly isNative: boolean;

  protected config: AIProviderConfig = {};

  initialize(config: AIProviderConfig): void {
    this.config = config;
  }

  // Default implementations that throw if not supported
  async analyze(_context: AIContext): Promise<AIResult> {
    throw new Error(`${this.key} does not support analyze`);
  }
  async summarize(_content: string, _context?: AIContext): Promise<AIResult> {
    throw new Error(`${this.key} does not support summarize`);
  }
  async classify(
    _input: string,
    _categories: string[],
    _context?: AIContext
  ): Promise<AIResult> {
    throw new Error(`${this.key} does not support classify`);
  }
  async score(_context: AIContext): Promise<AIResult> {
    throw new Error(`${this.key} does not support score`);
  }
  async recommend(_context: AIContext): Promise<AIResult> {
    throw new Error(`${this.key} does not support recommend`);
  }
  async extractEntities(_text: string): Promise<AIResult> {
    throw new Error(`${this.key} does not support extractEntities`);
  }
  async generateText(
    _prompt: string,
    _context?: AIContext
  ): Promise<AIResult> {
    throw new Error(`${this.key} does not support generateText`);
  }

  async healthcheck() {
    return { healthy: true, message: "OK", latencyMs: 0 };
  }

  estimateCost(_taskType: AITaskType, _inputLength: number) {
    return { estimatedCost: 0, currency: "USD" };
  }
}
