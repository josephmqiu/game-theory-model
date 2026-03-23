import { describe, expect, it } from "vitest";
import { formatPhaseActivityNote } from "../phase-activity-format";

describe("formatPhaseActivityNote", () => {
  it("prefers the WebSearch query over the generic message", () => {
    expect(
      formatPhaseActivityNote({
        type: "phase_activity",
        phase: "situational-grounding",
        runId: "run-1",
        kind: "web-search",
        message: "Using WebSearch",
        query: "US China tariff history 2025",
      }),
    ).toBe("Using WebSearch: US China tariff history 2025");
  });

  it("falls back to the provided message when no query is present", () => {
    expect(
      formatPhaseActivityNote({
        type: "phase_activity",
        phase: "situational-grounding",
        runId: "run-1",
        kind: "web-search",
        message: "Using WebSearch",
      }),
    ).toBe("Using WebSearch");
  });
});
