/**
 * Provider Registry
 *
 * Central registry of all available integration providers.
 * Adding a new provider means:
 *   1. Implement IntegrationProvider
 *   2. Register it here
 *   3. Done.
 */

import type { IntegrationProvider, ProviderMetadata } from "./provider-contract";

class ProviderRegistry {
  private providers = new Map<string, IntegrationProvider>();

  /**
   * Register a provider instance.
   */
  register(provider: IntegrationProvider): void {
    if (this.providers.has(provider.metadata.key)) {
      console.warn(
        `Provider "${provider.metadata.key}" is already registered. Overwriting.`
      );
    }
    this.providers.set(provider.metadata.key, provider);
  }

  /**
   * Get a provider by key.
   * Returns undefined if not found.
   */
  get(key: string): IntegrationProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * Get a provider by key or throw.
   */
  getOrThrow(key: string): IntegrationProvider {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`Integration provider "${key}" not found in registry`);
    }
    return provider;
  }

  /**
   * List all registered providers.
   */
  list(): ProviderMetadata[] {
    return Array.from(this.providers.values()).map((p) => p.metadata);
  }

  /**
   * List providers by domain.
   */
  listByDomain(domain: string): ProviderMetadata[] {
    return this.list().filter((m) => m.domain === domain);
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
export const providerRegistry = new ProviderRegistry();
