import { describe, it, expect } from "vitest";
import type { EntityProvenance } from "../entity";

describe("EntityProvenance type", () => {
  it("supports phase-derived provenance", () => {
    const p: EntityProvenance = {
      source: "phase-derived",
      runId: "run-123",
      phase: "situational-grounding",
      timestamp: Date.now(),
      webSearchAvailable: true,
    };
    expect(p.source).toBe("phase-derived");
    expect(p.previousOrigin).toBeUndefined();
  });

  it("supports provenance chaining via previousOrigin", () => {
    const original: EntityProvenance = {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
      timestamp: 1000,
    };
    const edited: EntityProvenance = {
      source: "user-edited",
      timestamp: 2000,
      previousOrigin: original,
    };
    expect(edited.previousOrigin?.source).toBe("phase-derived");
    expect(edited.previousOrigin?.runId).toBe("run-1");
  });

  it("supports ai-edited provenance", () => {
    const p: EntityProvenance = {
      source: "ai-edited",
      runId: "run-5",
      timestamp: 3000,
    };
    expect(p.source).toBe("ai-edited");
  });

  it("webSearchAvailable defaults to undefined", () => {
    const p: EntityProvenance = {
      source: "phase-derived",
      timestamp: 1000,
    };
    expect(p.webSearchAvailable).toBeUndefined();
  });
});
