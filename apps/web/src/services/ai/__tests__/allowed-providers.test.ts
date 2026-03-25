// src/services/ai/__tests__/allowed-providers.test.ts
import { describe, it, expect } from "vitest";
import {
  ALLOWED_PROVIDERS,
  PROVIDER_LABELS,
  isAllowedProvider,
  type AllowedProvider,
} from "../allowed-providers";

describe("allowed-providers", () => {
  it("allows only anthropic and openai", () => {
    expect(ALLOWED_PROVIDERS).toEqual(["anthropic", "openai"]);
    // Verify type is exported and assignable
    const _check: AllowedProvider = ALLOWED_PROVIDERS[0];
    expect(_check).toBe("anthropic");
  });

  it("provides human-readable labels", () => {
    expect(PROVIDER_LABELS.anthropic).toBe("Claude");
    expect(PROVIDER_LABELS.openai).toBe("Codex");
  });

  it("isAllowedProvider returns true for allowed providers", () => {
    expect(isAllowedProvider("anthropic")).toBe(true);
    expect(isAllowedProvider("openai")).toBe(true);
  });

  it("isAllowedProvider returns false for disallowed providers", () => {
    expect(isAllowedProvider("opencode")).toBe(false);
    expect(isAllowedProvider("copilot")).toBe(false);
    expect(isAllowedProvider("gemini")).toBe(false);
    expect(isAllowedProvider("")).toBe(false);
  });
});
