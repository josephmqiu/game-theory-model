import { describe, it, expect } from "vitest";
import { analysisReportDataSchema } from "@/types/entity";

describe("analysisReportDataSchema", () => {
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

  it("validates a complete report without prediction verdict", () => {
    expect(analysisReportDataSchema.safeParse(validReport).success).toBe(true);
  });

  it("validates a report with prediction verdict", () => {
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

  it("rejects missing required fields", () => {
    const missing = { type: "analysis-report" };
    expect(analysisReportDataSchema.safeParse(missing).success).toBe(false);
  });

  it("validates entity_references array structure", () => {
    const badRef = {
      ...validReport,
      entity_references: [{ entity_id: "abc" }], // missing display_name
    };
    expect(analysisReportDataSchema.safeParse(badRef).success).toBe(false);
  });
});
