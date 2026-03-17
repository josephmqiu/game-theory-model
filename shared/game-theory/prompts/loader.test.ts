import { describe, it, expect } from "vitest";
import {
  loadSystemPrompt,
  loadPhaseMethodology,
  loadToolDescription,
} from "./loader";

describe("loadSystemPrompt", () => {
  it('loads system prompt as a non-empty string containing "game theory"', () => {
    const result = loadSystemPrompt();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result.toLowerCase()).toContain("game theory");
  });
});

describe("loadPhaseMethodology", () => {
  it("loads phase 1 methodology as a non-empty string", () => {
    const result = loadPhaseMethodology(1);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns fallback containing "not available" for missing phase 99', () => {
    const result = loadPhaseMethodology(99);
    expect(result).toContain("not available");
  });
});

describe("loadToolDescription", () => {
  it("returns fallback for missing tool description", () => {
    const result = loadToolDescription("nonexistent-tool");
    expect(result).toBe("Tool: nonexistent-tool");
  });
});
