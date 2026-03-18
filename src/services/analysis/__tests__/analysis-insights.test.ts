import { describe, expect, it } from "vitest";
import { createDefaultAnalysis } from "@/services/analysis/analysis-normalization";
import { validateAnalysis } from "@/services/analysis/analysis-validation";
import { createAnalysisInsights } from "@/services/analysis/analysis-insights";

function setPayoffs(
  analysis: ReturnType<typeof createDefaultAnalysis>,
  payoffs: Array<[number, number]>,
) {
  analysis.profiles = analysis.profiles.map((profile, index) => ({
    ...profile,
    payoffs: payoffs[index] ?? [null, null],
  }));
}

describe("analysis insights", () => {
  it("blocks invalid analyses before computing strategic outputs", () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "   ";

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("blocked");
    if (insights.status === "blocked") {
      expect(insights.blockReason).toBe("invalid");
      expect(insights.blockMessage).toContain("validation issues");
    }
  });

  it("blocks incomplete analyses before computing strategic outputs", () => {
    const analysis = createDefaultAnalysis();
    const validation = validateAnalysis(analysis);

    const insights = createAnalysisInsights(analysis, validation);

    expect(insights.status).toBe("blocked");
    if (insights.status === "blocked") {
      expect(insights.blockReason).toBe("incomplete");
      expect(insights.blockMessage).toContain("Complete every payoff cell");
    }
  });

  it("finds a single pure Nash equilibrium and best responses", () => {
    const analysis = createDefaultAnalysis();
    analysis.players[0].name = "P1";
    analysis.players[1].name = "P2";
    analysis.players[0].strategies[0].name = "Top";
    analysis.players[0].strategies[1].name = "Bottom";
    analysis.players[1].strategies[0].name = "Left";
    analysis.players[1].strategies[1].name = "Right";
    setPayoffs(analysis, [
      [4, 4],
      [1, 5],
      [5, 1],
      [2, 2],
    ]);

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("ready");
    if (insights.status !== "ready") return;

    expect(insights.pureNashProfileKeys).toEqual([
      `${analysis.players[0].strategies[1].id}::${analysis.players[1].strategies[1].id}`,
    ]);
    expect(insights.equilibria).toHaveLength(1);
    expect(insights.equilibria[0]).toMatchObject({
      label: "P1: Bottom vs P2: Right",
      payoffs: [2, 2],
    });
    expect(insights.bestResponses[0].responses[0].strategyNames).toEqual([
      "Bottom",
    ]);
    expect(insights.bestResponses[1].responses[1].strategyNames).toEqual([
      "Right",
    ]);
  });

  it("keeps multiple equilibria when both profiles are best responses", () => {
    const analysis = createDefaultAnalysis();
    analysis.players[0].name = "P1";
    analysis.players[1].name = "P2";
    analysis.players[0].strategies[0].name = "A";
    analysis.players[0].strategies[1].name = "B";
    analysis.players[1].strategies[0].name = "X";
    analysis.players[1].strategies[1].name = "Y";
    setPayoffs(analysis, [
      [3, 3],
      [0, 0],
      [0, 0],
      [2, 2],
    ]);

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("ready");
    if (insights.status !== "ready") return;

    expect(insights.equilibria).toHaveLength(2);
    expect(insights.pureNashProfileKeys).toEqual(
      expect.arrayContaining([
        `${analysis.players[0].strategies[0].id}::${analysis.players[1].strategies[0].id}`,
        `${analysis.players[0].strategies[1].id}::${analysis.players[1].strategies[1].id}`,
      ]),
    );
  });

  it("reports no pure Nash equilibria when none exist", () => {
    const analysis = createDefaultAnalysis();
    analysis.players[0].name = "P1";
    analysis.players[1].name = "P2";
    analysis.players[0].strategies[0].name = "A";
    analysis.players[0].strategies[1].name = "B";
    analysis.players[1].strategies[0].name = "X";
    analysis.players[1].strategies[1].name = "Y";
    setPayoffs(analysis, [
      [1, 0],
      [0, 1],
      [0, 1],
      [1, 0],
    ]);

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("ready");
    if (insights.status !== "ready") return;

    expect(insights.equilibria).toHaveLength(0);
    expect(insights.pureNashProfileKeys).toEqual([]);
  });

  it("detects strict dominant strategies", () => {
    const analysis = createDefaultAnalysis();
    analysis.players[0].name = "P1";
    analysis.players[1].name = "P2";
    analysis.players[0].strategies[0].name = "Aggressive";
    analysis.players[0].strategies[1].name = "Passive";
    analysis.players[1].strategies[0].name = "L";
    analysis.players[1].strategies[1].name = "R";
    setPayoffs(analysis, [
      [5, 1],
      [6, 2],
      [4, 0],
      [3, -1],
    ]);

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("ready");
    if (insights.status !== "ready") return;

    expect(insights.dominance[0]).toMatchObject({
      kind: "strict",
      strategyNames: ["Aggressive"],
    });
  });

  it("detects weak dominant strategies when strict dominance is absent", () => {
    const analysis = createDefaultAnalysis();
    analysis.players[0].name = "P1";
    analysis.players[1].name = "P2";
    analysis.players[0].strategies[0].name = "Safe";
    analysis.players[0].strategies[1].name = "Risky";
    analysis.players[1].strategies[0].name = "L";
    analysis.players[1].strategies[1].name = "R";
    setPayoffs(analysis, [
      [2, 2],
      [1, 0],
      [2, 1],
      [0, -1],
    ]);

    const insights = createAnalysisInsights(analysis, validateAnalysis(analysis));

    expect(insights.status).toBe("ready");
    if (insights.status !== "ready") return;

    expect(insights.dominance[0]).toMatchObject({
      kind: "weak",
      strategyNames: ["Safe"],
    });
  });
});
