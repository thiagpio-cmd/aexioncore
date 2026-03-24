/**
 * AI Provider Registration
 *
 * Registers all available AI providers with the central registry.
 * Adding a new AI provider means:
 *   1. Implement BaseAIProvider
 *   2. Import and register it here
 *   3. Done.
 */

import { NativeRuleEngine } from "./native-rule-engine";
import { OpenAIProvider } from "./openai-provider";
import { AnthropicProvider } from "./anthropic-provider";
import { aiRegistry } from "../ai-registry";

export function registerAllAIProviders(): void {
  aiRegistry.register(new NativeRuleEngine());
  aiRegistry.register(new OpenAIProvider());
  aiRegistry.register(new AnthropicProvider());
}

export { NativeRuleEngine, OpenAIProvider, AnthropicProvider };
