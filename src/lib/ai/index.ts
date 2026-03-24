/**
 * AI Module — Barrel Exports
 *
 * Central export point for the entire AI subsystem.
 *
 * Usage:
 *   import { defaultRouter, aiRegistry, registerAllAIProviders } from "@/lib/ai";
 *
 *   // Initialize once at app startup
 *   registerAllAIProviders();
 *
 *   // Route a task to the best provider
 *   const result = await defaultRouter.execute("score", context);
 */

// Contract
export type {
  AITaskType,
  AIContext,
  AIResult,
  AIProviderConfig,
  AIProvider,
} from "./ai-provider-contract";
export { BaseAIProvider } from "./ai-provider-contract";

// Registry
export { aiRegistry } from "./ai-registry";

// Router
export type { AIRouterConfig } from "./ai-router";
export { AIRouter, defaultRouter } from "./ai-router";

// Providers
export {
  registerAllAIProviders,
  NativeRuleEngine,
  OpenAIProvider,
  AnthropicProvider,
} from "./providers";
