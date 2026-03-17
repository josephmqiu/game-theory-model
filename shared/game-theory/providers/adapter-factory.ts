import type { ProviderAdapter } from "../types/agent";
import { createAnthropicAdapter } from "./anthropic-adapter";
import { createGenericAdapter } from "./generic-adapter";
import { createOpenAIAdapter } from "./openai-adapter";

export function createProviderAdapter(provider: string): ProviderAdapter {
  switch (provider) {
    case "anthropic":
      return createAnthropicAdapter();
    case "openai":
      return createOpenAIAdapter();
    default:
      return createGenericAdapter(provider);
  }
}
