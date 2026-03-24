import { describe, it, expect } from "vitest";
import { analysisReportDataSchema } from "@/types/entity";

describe("analysis report schema validation", () => {
  const validReport = {
    type: "analysis-report" as const,
    executive_summary: "The US-China trade situation favors de-escalation.",
    why: "Both players face domestic pressure to compromise.",
    key_evidence: ["Tariff costs exceed benefits for both sides"],
    open_assumptions: ["No third-party escalation trigger"],
    entity_references: [
      { entity_id: "abc-123", display_name: "United States" },
    ],
    prediction_verdict: null,
    what_would_change: ["Military incident in Taiwan Strait"],
    source_url: null,
    analysis_timestamp: "2026-03-23T12:00:00Z",
  };

  // ── Core report structure ──

  it("accepts a complete report with null prediction verdict (pure analysis, no market question)", () => {
    expect(analysisReportDataSchema.safeParse(validReport).success).toBe(true);
  });

  it("accepts a report with a full prediction verdict (market-pricing analysis)", () => {
    const withVerdict = {
      ...validReport,
      prediction_verdict: {
        event_question: "Will the Fed cut rates in June 2026?",
        predicted_probability: 72,
        market_probability: 58,
        price_as_of: "2026-03-23T10:00:00Z",
        edge: 14,
        verdict: "underpriced" as const,
        bet_direction: "yes" as const,
        confidence: "high" as const,
      },
    };
    expect(analysisReportDataSchema.safeParse(withVerdict).success).toBe(true);
  });

  // ── Required fields enforce analytical completeness ──

  it("rejects a report missing executive_summary -- every report must have a conclusion", () => {
    const { executive_summary: _, ...missing } = validReport;
    expect(analysisReportDataSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects empty executive_summary -- a blank conclusion provides no analytical value", () => {
    const empty = { ...validReport, executive_summary: "" };
    expect(analysisReportDataSchema.safeParse(empty).success).toBe(false);
  });

  it("rejects empty key_evidence array -- a conclusion must cite at least one evidence point", () => {
    const noEvidence = { ...validReport, key_evidence: [] };
    expect(analysisReportDataSchema.safeParse(noEvidence).success).toBe(false);
  });

  it("rejects empty what_would_change array -- every analysis must state its invalidation conditions", () => {
    const noChange = { ...validReport, what_would_change: [] };
    expect(analysisReportDataSchema.safeParse(noChange).success).toBe(false);
  });

  it("allows empty open_assumptions -- some analyses have no unresolved assumptions", () => {
    const noAssumptions = { ...validReport, open_assumptions: [] };
    expect(analysisReportDataSchema.safeParse(noAssumptions).success).toBe(
      true,
    );
  });

  it("allows empty entity_references -- a report can exist without referencing specific entities", () => {
    const noRefs = { ...validReport, entity_references: [] };
    expect(analysisReportDataSchema.safeParse(noRefs).success).toBe(true);
  });

  // ── Entity reference integrity ──

  it("rejects entity references missing display_name -- each reference must be human-readable", () => {
    const badRef = {
      ...validReport,
      entity_references: [{ entity_id: "abc" }],
    };
    expect(analysisReportDataSchema.safeParse(badRef).success).toBe(false);
  });

  it("rejects entity references with empty entity_id -- a reference must point to a real entity", () => {
    const emptyId = {
      ...validReport,
      entity_references: [{ entity_id: "", display_name: "USA" }],
    };
    expect(analysisReportDataSchema.safeParse(emptyId).success).toBe(false);
  });

  // ── Prediction verdict validation ──

  it("rejects predicted_probability outside 0-100 range -- probabilities are percentages", () => {
    const overRange = {
      ...validReport,
      prediction_verdict: {
        event_question: "Test?",
        predicted_probability: 150,
        market_probability: 50,
        price_as_of: null,
        edge: null,
        verdict: null,
        bet_direction: null,
        confidence: "medium" as const,
      },
    };
    expect(analysisReportDataSchema.safeParse(overRange).success).toBe(false);
  });

  it("accepts verdict with nullable market fields -- not all predictions have market prices", () => {
    const noMarket = {
      ...validReport,
      prediction_verdict: {
        event_question: "Will sanctions be imposed?",
        predicted_probability: 45,
        market_probability: null,
        price_as_of: null,
        edge: null,
        verdict: null,
        bet_direction: null,
        confidence: "low" as const,
      },
    };
    expect(analysisReportDataSchema.safeParse(noMarket).success).toBe(true);
  });

  it("rejects unknown verdict values -- only overpriced/underpriced/fair are valid market assessments", () => {
    const badVerdict = {
      ...validReport,
      prediction_verdict: {
        event_question: "Test?",
        predicted_probability: 50,
        market_probability: 50,
        price_as_of: null,
        edge: 0,
        verdict: "neutral",
        bet_direction: "yes",
        confidence: "medium",
      },
    };
    expect(analysisReportDataSchema.safeParse(badVerdict).success).toBe(false);
  });
});
