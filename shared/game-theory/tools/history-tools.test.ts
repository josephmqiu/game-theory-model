import { describe, it, expect } from "vitest";
import { createHistoryTools } from "./history-tools";
import { createPlayerTools } from "./player-tools";
import { createGameTools } from "./game-tools";
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

describe("createHistoryTools", () => {
  it("returns 4 tools with correct names", () => {
    const tools = createHistoryTools();
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_trust_assessment");
    expect(names).toContain("update_trust_assessment");
    expect(names).toContain("add_repeated_game_pattern");
    expect(names).toContain("add_dynamic_inconsistency_risk");
  });
});

describe("add_trust_assessment", () => {
  const historyTools = createHistoryTools();
  const playerTools = createPlayerTools();
  const addTrust = historyTools.find((t) => t.name === "add_trust_assessment")!;
  const addPlayer = playerTools.find((t) => t.name === "add_player")!;

  it("creates a trust assessment in canonical.trust_assessments", async () => {
    const { context, getStore } = makeTestContext();

    // Create required prerequisite players
    const pa = (await addPlayer.execute(
      { name: "Player A" },
      context,
    )) as ToolResult;
    const pb = (await addPlayer.execute(
      { name: "Player B" },
      context,
    )) as ToolResult;
    if (!pa.success || !pb.success) return;
    const pid_a = (pa.data as { id: string }).id;
    const pid_b = (pb.data as { id: string }).id;

    const result = (await addTrust.execute(
      {
        assessor_player_id: pid_a,
        target_player_id: pid_b,
        level: "low",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.trust_assessments)).toHaveLength(1);
    const ta = Object.values(store.trust_assessments)[0]!;
    expect(ta.level).toBe("low");
    expect(ta.assessor_player_id).toBe(pid_a);
    expect(ta.target_player_id).toBe(pid_b);
  });

  it("rejects missing level", async () => {
    const { context } = makeTestContext();
    const result = (await addTrust.execute(
      { assessor_player_id: "a", target_player_id: "b" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("update_trust_assessment", () => {
  const historyTools = createHistoryTools();
  const playerTools = createPlayerTools();
  const addTrust = historyTools.find((t) => t.name === "add_trust_assessment")!;
  const updateTrust = historyTools.find(
    (t) => t.name === "update_trust_assessment",
  )!;
  const addPlayer = playerTools.find((t) => t.name === "add_player")!;

  it("updates trust level", async () => {
    const { context, getStore } = makeTestContext();

    const pa = (await addPlayer.execute({ name: "A" }, context)) as ToolResult;
    const pb = (await addPlayer.execute({ name: "B" }, context)) as ToolResult;
    if (!pa.success || !pb.success) return;
    const pid_a = (pa.data as { id: string }).id;
    const pid_b = (pb.data as { id: string }).id;

    const addResult = (await addTrust.execute(
      { assessor_player_id: pid_a, target_player_id: pid_b, level: "low" },
      context,
    )) as ToolResult;
    if (!addResult.success) return;
    const id = (addResult.data as { id: string }).id;

    const updateResult = (await updateTrust.execute(
      { id, level: "high" },
      context,
    )) as ToolResult;

    expect(updateResult.success).toBe(true);
    const store = getStore();
    const ta = store.trust_assessments[id]!;
    expect(ta.level).toBe("high");
  });

  it("rejects missing id", async () => {
    const { context } = makeTestContext();
    const result = (await updateTrust.execute(
      { level: "high" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_repeated_game_pattern", () => {
  const historyTools = createHistoryTools();
  const gameTools = createGameTools();
  const addPattern = historyTools.find(
    (t) => t.name === "add_repeated_game_pattern",
  )!;
  const addGame = gameTools.find((t) => t.name === "add_game")!;

  it("creates a repeated game pattern for an existing game", async () => {
    const { context, getStore } = makeTestContext();

    // Create prerequisite game
    const gameResult = (await addGame.execute(
      { name: "Trade Game", description: "A trade negotiation game." },
      context,
    )) as ToolResult;
    if (!gameResult.success) return;
    const gameId = (gameResult.data as { id: string }).id;

    const result = (await addPattern.execute(
      {
        game_id: gameId,
        pattern_type: "tit_for_tat",
        description: "Observed tit-for-tat over 5 rounds",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.repeated_game_patterns)).toHaveLength(1);
    const pattern = Object.values(store.repeated_game_patterns)[0]!;
    expect(pattern.pattern_type).toBe("tit_for_tat");
    expect(pattern.game_id).toBe(gameId);
  });

  it("rejects missing pattern_type", async () => {
    const { context } = makeTestContext();
    const result = (await addPattern.execute(
      { game_id: "game_123" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_dynamic_inconsistency_risk", () => {
  const historyTools = createHistoryTools();
  const playerTools = createPlayerTools();
  const addRisk = historyTools.find(
    (t) => t.name === "add_dynamic_inconsistency_risk",
  )!;
  const addPlayer = playerTools.find((t) => t.name === "add_player")!;

  it("creates a dynamic inconsistency risk for an existing player", async () => {
    const { context, getStore } = makeTestContext();

    const playerResult = (await addPlayer.execute(
      { name: "Government" },
      context,
    )) as ToolResult;
    if (!playerResult.success) return;
    const playerId = (playerResult.data as { id: string }).id;

    const result = (await addRisk.execute(
      {
        player_id: playerId,
        commitment_description: "Promised no new tariffs",
        risk_type: "electoral_cycle",
        durability: "fragile",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.dynamic_inconsistency_risks)).toHaveLength(1);
    const risk = Object.values(store.dynamic_inconsistency_risks)[0]!;
    expect(risk.risk_type).toBe("electoral_cycle");
    expect(risk.durability).toBe("fragile");
    expect(risk.player_id).toBe(playerId);
  });

  it("rejects missing required fields", async () => {
    const { context } = makeTestContext();
    const result = (await addRisk.execute(
      { player_id: "player_1" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});
