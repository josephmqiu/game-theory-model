// src/services/ai/__tests__/allowed-providers.test.ts
import { describe, it, expect } from "vitest";
import {
  ALLOWED_PROVIDERS,
  PROVIDER_LABELS,
  isAllowedProvider,
  type AllowedProvider,
} from "../allowed-providers";

describe("allowed-providers", () => {
  it("allows only claude and codex", () => {
    expect(ALLOWED_PROVIDERS).toEqual(["claude", "codex"]);
    // Verify type is exported and assignable
    const _check: AllowedProvider = ALLOWED_PROVIDERS[0];
    expect(_check).toBe("claude");
  });

  it("provides human-readable labels", () => {
    expect(PROVIDER_LABELS.claude).toBe("Claude");
    expect(PROVIDER_LABELS.codex).toBe("Codex");
  });

  it("isAllowedProvider returns true for allowed providers", () => {
    expect(isAllowedProvider("claude")).toBe(true);
    expect(isAllowedProvider("codex")).toBe(true);
  });

  it("isAllowedProvider returns false for disallowed providers", () => {
    expect(isAllowedProvider("gemini")).toBe(false);
    expect(isAllowedProvider("unknown")).toBe(false);
    expect(isAllowedProvider("")).toBe(false);
  });
});
