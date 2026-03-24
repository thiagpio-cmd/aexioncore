/**
 * Integration initialization
 * Ensures providers are registered on first use
 */

import { registerAllProviders } from "./providers";

let initialized = false;

export function ensureProvidersInitialized(): void {
  if (!initialized) {
    registerAllProviders();
    initialized = true;
  }
}
