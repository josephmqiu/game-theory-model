import { describe, it, expect } from "vitest";
import { createProviderAdapter } from "./adapter-factory";

describe("createProviderAdapter", () => {
  it("returns AnthropicAdapter for 'anthropic'", () => {
    const adapter = createProviderAdapter("anthropic");
    expect(adapter.name).toBe("anthropic");
    expect(adapter.capabilities.toolUse).toBe(true);
    expect(adapter.capabilities.webSearch).toBe(true);
    expect(adapter.capabilities.compaction).toBe(true);
  });

  it("returns OpenAIAdapter for 'openai'", () => {
    const adapter = createProviderAdapter("openai");
    expect(adapter.name).toBe("openai");
    expect(adapter.capabilities.toolUse).toBe(true);
    expect(adapter.capabilities.webSearch).toBe(true);
    expect(adapter.capabilities.compaction).toBe(true);
  });

  it("returns GenericAdapter for unknown provider", () => {
    const adapter = createProviderAdapter("some-unknown-provider");
    expect(adapter.name).toBe("some-unknown-provider");
  });

  it("GenericAdapter has no tool use capability", () => {
    const adapter = createProviderAdapter("some-unknown-provider");
    expect(adapter.capabilities.toolUse).toBe(false);
    expect(adapter.capabilities.webSearch).toBe(false);
    expect(adapter.capabilities.compaction).toBe(false);
  });

  it("GenericAdapter preserves the provider name passed to it", () => {
    const adapter = createProviderAdapter("my-custom-llm");
    expect(adapter.name).toBe("my-custom-llm");
  });
});
