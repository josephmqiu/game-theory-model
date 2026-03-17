import { describe, it, expect } from "vitest";
import { createScenarioTools } from "./scenario-tools";
import { createGameTools } from "./game-tools";
import { createPlayerTools } from "./player-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

function makeTestContext() {
  let store: CanonicalStore = emptyCanonicalStore();
  let eventLog: EventLog = createEventLog("test-analysis");

  const context: ToolContext = {
    get canonical() {
      return store;
    },
    dispatch: (command: Command) => {
      const result = dispatch(store, eventLog, command);
      if (result.status === "committed") {
        store = result.store;
        eventLog = result.event_log;
      }
      return result;
    },
    getAnalysisState: () => null,
    getDerivedState: () => ({
      readinessReportsByFormalization: {},
      solverResultsByFormalization: {},
      sensitivityByFormalizationAndSolver: {},
      dirtyFormalizations: {},
    }),
  };

  return { context, getStore: () => store };
}

/** Helper: create a game and a formalization, return formalization ID. */
async function setupFormalization(
  context: ToolContext,
): Promise<string | null> {
  const gameTools = createGameTools();
  const addGame = gameTools.find((t) => t.name === "add_game")!;
  const addFormalization = gameTools.find(
    (t) => t.name === "add_formalization",
  )!;

  const gameResult = (await addGame.execute(
    { name: "Test Game", description: "Setup game for testing." },
    context,
  )) as ToolResult;
  if (!gameResult.success) return null;
  const gameId = (gameResult.data as { id: string }).id;

  const formResult = (await addFormalization.execute(
    { game_id: gameId, kind: "normal_form", purpose: "explanatory" },
    context,
  )) as ToolResult;
  if (!formResult.success) return null;
  return (formResult.data as { id: string }).id;
}

describe("createScenarioTools", () => {
  it("returns 7 tools with correct names", () => {
    const tools = createScenarioTools();
    expect(tools).toHaveLength(7);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_scenario");
    expect(names).toContain("update_scenario");
    expect(names).toContain("add_tail_risk");
    expect(names).toContain("add_central_thesis");
    expect(names).toContain("update_central_thesis");
    expect(names).toContain("add_eliminated_outcome");
    expect(names).toContain("add_signal_classification");
  });
});

describe("add_scenario", () => {
  const tools = createScenarioTools();
  const addScenario = tools.find((t) => t.name === "add_scenario")!;

  it("creates a scenario entity linked to an existing formalization", async () => {
    const { context, getStore } = makeTestContext();

    const formalizationId = await setupFormalization(context);
    if (!formalizationId) return;

    const result = (await addScenario.execute(
      {
        name: "Escalation Spiral",
        narrative: "Both sides escalate until one backs down.",
        formalization_id: formalizationId,
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.scenarios)).toHaveLength(1);
    const scenario = Object.values(store.scenarios)[0]!;
    expect(scenario.name).toBe("Escalation Spiral");
    expect(scenario.narrative).toBe(
      "Both sides escalate until one backs down.",
    );
    expect(scenario.formalization_id).toBe(formalizationId);
  });

  it("stores probability estimate when provided", async () => {
    const { context, getStore } = makeTestContext();

    const formalizationId = await setupFormalization(context);
    if (!formalizationId) return;

    await addScenario.execute(
      {
        name: "Cooperation",
        narrative: "Both cooperate.",
        formalization_id: formalizationId,
        probability_value: 0.35,
      },
      context,
    );

    const store = getStore();
    const scenario = Object.values(store.scenarios)[0]!;
    expect(scenario.estimated_probability?.value).toBe(0.35);
  });

  it("rejects missing narrative", async () => {
    const { context } = makeTestContext();
    const result = (await addScenario.execute(
      { name: "Bad Scenario", formalization_id: "form_1" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_tail_risk", () => {
  const tools = createScenarioTools();
  const addTailRisk = tools.find((t) => t.name === "add_tail_risk")!;

  it("creates a tail risk entity", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addTailRisk.execute(
      {
        event_description: "Nuclear exchange",
        trigger: "Conventional war escalation",
        consequences: "Catastrophic",
        probability_value: 0.01,
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.tail_risks)).toHaveLength(1);
    const tailRisk = Object.values(store.tail_risks)[0]!;
    expect(tailRisk.event_description).toBe("Nuclear exchange");
    expect(tailRisk.probability.value).toBe(0.01);
  });

  it("rejects missing event_description", async () => {
    const { context } = makeTestContext();
    const result = (await addTailRisk.execute({}, context)) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_central_thesis", () => {
  const tools = createScenarioTools();
  const addThesis = tools.find((t) => t.name === "add_central_thesis")!;

  it("creates a central thesis", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addThesis.execute(
      {
        statement: "China will not invade Taiwan in this period.",
        falsification_condition: "PLA begins amphibious exercises at scale.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.central_theses)).toHaveLength(1);
    const thesis = Object.values(store.central_theses)[0]!;
    expect(thesis.statement).toBe(
      "China will not invade Taiwan in this period.",
    );
    expect(thesis.falsification_condition).toBe(
      "PLA begins amphibious exercises at scale.",
    );
  });

  it("rejects missing falsification_condition", async () => {
    const { context } = makeTestContext();
    const result = (await addThesis.execute(
      { statement: "Some thesis." },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_eliminated_outcome", () => {
  const tools = createScenarioTools();
  const addEliminated = tools.find((t) => t.name === "add_eliminated_outcome")!;

  it("creates an eliminated outcome", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addEliminated.execute(
      {
        outcome_description: "Full economic decoupling in 6 months",
        elimination_reasoning: "Supply chains cannot be reorganized that fast.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.eliminated_outcomes)).toHaveLength(1);
    const eo = Object.values(store.eliminated_outcomes)[0]!;
    expect(eo.outcome_description).toBe("Full economic decoupling in 6 months");
    expect(eo.surprise_factor).toBe("low");
  });

  it("rejects missing elimination_reasoning", async () => {
    const { context } = makeTestContext();
    const result = (await addEliminated.execute(
      { outcome_description: "Something" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_signal_classification", () => {
  const scenarioTools = createScenarioTools();
  const playerTools = createPlayerTools();
  const addSignal = scenarioTools.find(
    (t) => t.name === "add_signal_classification",
  )!;
  const addPlayer = playerTools.find((t) => t.name === "add_player")!;

  it("creates a signal classification linked to an existing player", async () => {
    const { context, getStore } = makeTestContext();

    // signal_classification.player_id must reference an existing player
    const playerResult = (await addPlayer.execute(
      { name: "Country A" },
      context,
    )) as ToolResult;
    if (!playerResult.success) return;
    const playerId = (playerResult.data as { id: string }).id;

    const result = (await addSignal.execute(
      {
        signal_ref: "troop_deployment_signal",
        classification: "costly_signal",
        player_id: playerId,
        cost_description: "Significant military resource commitment.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.signal_classifications)).toHaveLength(1);
    const sc = Object.values(store.signal_classifications)[0]!;
    expect(sc.classification).toBe("costly_signal");
    expect(sc.player_id).toBe(playerId);
  });

  it("rejects invalid classification", async () => {
    const { context } = makeTestContext();
    const result = (await addSignal.execute(
      { signal_ref: "x", classification: "very_cheap_talk" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});
