/**
 * AI Router
 *
 * Routes AI tasks to the right provider based on configuration.
 * Handles fallback chains, retries, and logging.
 */

import type { AIContext, AIProvider, AIResult, AITaskType } from "./ai-provider-contract";
import { aiRegistry } from "./ai-registry";

// ─── Router Configuration ───────────────────────────────────────────────────

export interface AIRouterConfig {
  /** Map task types to specific provider keys */
  taskRouting?: Partial<Record<AITaskType, string>>;
  /** Provider keys in fallback order */
  fallbackChain?: string[];
  /** Prefer native providers over external ones */
  preferNative?: boolean;
  /** Max retries before moving to next provider in chain */
  maxRetries?: number;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export class AIRouter {
  constructor(private config: AIRouterConfig = {}) {}

  /**
   * Execute an AI task, routing to the best available provider.
   *
   * Routing logic:
   * 1. Check if a specific provider is configured for this task type
   * 2. If not, get the best provider (native first if preferNative)
   * 3. Try execution
   * 4. On failure, try fallback chain
   * 5. Log the result
   */
  async execute(
    taskType: AITaskType,
    context: AIContext,
    options?: { categories?: string[]; content?: string; prompt?: string }
  ): Promise<AIResult> {
    const providersToTry = this.resolveProviderChain(taskType);

    if (providersToTry.length === 0) {
      throw new Error(
        `No AI provider available for task type "${taskType}"`
      );
    }

    let lastError: Error | undefined;

    for (const provider of providersToTry) {
      const retries = this.config.maxRetries ?? 1;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await this.dispatch(
            provider,
            taskType,
            context,
            options
          );
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(
            `AI Router: ${provider.key} failed for ${taskType} (attempt ${attempt + 1}/${retries}): ${lastError.message}`
          );
        }
      }
    }

    throw new Error(
      `All AI providers failed for task "${taskType}": ${lastError?.message ?? "unknown error"}`
    );
  }

  /**
   * Resolve the ordered list of providers to try for a given task.
   */
  private resolveProviderChain(taskType: AITaskType): AIProvider[] {
    const providers: AIProvider[] = [];
    const seen = new Set<string>();

    // 1. Check explicit task routing
    const explicitKey = this.config.taskRouting?.[taskType];
    if (explicitKey) {
      const explicit = aiRegistry.get(explicitKey);
      if (explicit && explicit.supportedTasks.includes(taskType)) {
        providers.push(explicit);
        seen.add(explicitKey);
      }
    }

    // 2. Get best provider for this task
    const best = aiRegistry.getBestForTask(
      taskType,
      this.config.preferNative ?? true
    );
    if (best && !seen.has(best.key)) {
      providers.push(best);
      seen.add(best.key);
    }

    // 3. Add fallback chain providers
    if (this.config.fallbackChain) {
      for (const key of this.config.fallbackChain) {
        if (seen.has(key)) continue;
        const fallback = aiRegistry.get(key);
        if (fallback && fallback.supportedTasks.includes(taskType)) {
          providers.push(fallback);
          seen.add(key);
        }
      }
    }

    // 4. Add any remaining capable providers
    const allCapable = aiRegistry.getForTask(taskType);
    for (const p of allCapable) {
      if (!seen.has(p.key)) {
        providers.push(p);
        seen.add(p.key);
      }
    }

    return providers;
  }

  /**
   * Dispatch a task to a specific provider.
   */
  private async dispatch(
    provider: AIProvider,
    taskType: AITaskType,
    context: AIContext,
    options?: { categories?: string[]; content?: string; prompt?: string }
  ): Promise<AIResult> {
    switch (taskType) {
      case "score":
        return provider.score(context);
      case "recommend":
      case "next_best_action":
        return provider.recommend(context);
      case "classify":
        return provider.classify(
          options?.content ?? JSON.stringify(context.data),
          options?.categories ?? [],
          context
        );
      case "analyze_sentiment":
        return provider.analyze(context);
      case "summarize":
        return provider.summarize(
          options?.content ?? JSON.stringify(context.data),
          context
        );
      case "extract_entities":
        return provider.extractEntities(
          options?.content ?? JSON.stringify(context.data)
        );
      case "generate_text":
        return provider.generateText(
          options?.prompt ?? "",
          context
        );
      default: {
        // Exhaustive check
        const _exhaustive: never = taskType;
        throw new Error(`Unknown task type: ${_exhaustive}`);
      }
    }
  }
}

// Default router instance — prefers native providers
export const defaultRouter = new AIRouter({ preferNative: true });
