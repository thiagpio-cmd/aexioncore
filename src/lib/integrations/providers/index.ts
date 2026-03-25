/**
 * Provider Registration
 *
 * Imports all available integration providers and registers them
 * with the central provider registry.
 *
 * To add a new provider:
 *   1. Create the provider file in this directory
 *   2. Import it here
 *   3. Add it to registerAllProviders()
 */

import { providerRegistry } from "../provider-registry";
import { GmailProvider } from "./gmail";
import { GoogleCalendarProvider } from "./google-calendar";
import { OutlookProvider } from "./outlook";
import { TwilioProvider } from "./twilio";
import { SlackProvider } from "./slack";

/**
 * Register all available integration providers with the registry.
 * Call this once at application startup.
 */
export function registerAllProviders(): void {
  providerRegistry.register(new GmailProvider());
  providerRegistry.register(new GoogleCalendarProvider());
  providerRegistry.register(new OutlookProvider());
  providerRegistry.register(new TwilioProvider());
  providerRegistry.register(new SlackProvider());
}

// Re-export individual providers for direct use
export { GmailProvider } from "./gmail";
export { GoogleCalendarProvider } from "./google-calendar";
export { OutlookProvider } from "./outlook";
export { TwilioProvider } from "./twilio";
export { SlackProvider } from "./slack";
