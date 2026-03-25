import { describe, expect, it } from "vitest";

import {
  SUPPORTED_ANALYSIS_PHASES,
  getCanonicalAnalysisPhaseIndex,
  normalizeRequestedActivePhases,
} from "../analysis-phase-selection";

describe("analysis-phase-selection", () => {
  it("returns the full canonical phase set when activePhases is omitted", () => {
    expect(normalizeRequestedActivePhases()).toEqual(SUPPORTED_ANALYSIS_PHASES);
  });

  it("dedupes requested phases and canonicalizes request order", () => {
    expect(
      normalizeRequestedActivePhases([
        "scenarios",
        "situational-grounding",
        "baseline-model",
        "baseline-model",
      ]),
    ).toEqual(["situational-grounding", "baseline-model", "scenarios"]);
  });

  it("rejects non-array activePhases", () => {
    expect(() =>
      normalizeRequestedActivePhases("baseline-model" as never),
    ).toThrow("activePhases must be an array of supported phases");
  });

  it("rejects unknown phases", () => {
    expect(() =>
      normalizeRequestedActivePhases(["revalidation" as never]),
    ).toThrow("Invalid activePhases: revalidation");
  });

  it("rejects an empty normalized phase set", () => {
    expect(() => normalizeRequestedActivePhases([])).toThrow(
      "activePhases must include at least one supported canonical phase",
    );
  });

  it("returns canonical indices for runnable phases", () => {
    expect(getCanonicalAnalysisPhaseIndex("situational-grounding")).toBe(0);
    expect(getCanonicalAnalysisPhaseIndex("scenarios")).toBe(
      SUPPORTED_ANALYSIS_PHASES.indexOf("scenarios"),
    );
  });
});
