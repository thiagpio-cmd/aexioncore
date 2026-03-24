/**
 * AI Provider Registry
 *
 * Central registry of all available AI providers.
 * Same pattern as the integration provider-registry:
 *   1. Implement AIProvider
 *   2. Register it here
 *   3. Done.
 */

import type { AIProvider, AITaskType } from "./ai-provider-contract";

class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();

  /**
   * Register an AI provider instance.
   */
  register(provider: AIProvider): void {
    if (this.providers.has(provider.key)) {
      console.warn(
        `AI Provider "${provider.key}" is already registered. Overwriting.`
      );
    }
    this.providers.set(provider.key, provider);
  }

  /**
   * Get a provider by key.
   * Returns undefined if not found.
   */
  get(key: string): AIProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * Get a provider by key or throw.
   */
  getOrThrow(key: string): AIProvider {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`AI Provider "${key}" not found in registry`);
    }
    return provider;
  }

  /**
   * List all registered providers.
   */
  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a specific task type.
   */
  getForTask(taskType: AITaskType): AIProvider[] {
    return this.list().filter((p) => p.supportedTasks.includes(taskType));
  }

  /**
   * Get the best provider for a task type.
   * Prefers native providers when preferNative is true (default).
   */
  getBestForTask(
    taskType: AITaskType,
    preferNative = true
  ): AIProvider | undefined {
    const capable = this.getForTask(taskType);
    if (capable.length === 0) return undefined;

    if (preferNative) {
      const native = capable.find((p) => p.isNative);
      if (native) return native;
    }

    // Return the first non-native provider, or just the first one
    return capable.find((p) => !p.isNative) ?? capable[0];
  }

  /**
   * Check if a provider is registered.
   */
  has(key: string): boolean {
    return this.providers.has(key);
  }

  /**
   * Total registered providers.
   */
  get size(): number {
    return this.providers.size;
  }
}

// Singleton instance
export const aiRegistry = new AIProviderRegistry();
