import { describe, it, expect } from "vitest";
import { createGameTools } from "./game-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

// ── Test context factory ──────────────────────────────────────────────────────

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

  return {
    context,
    getStore: () => store,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createGameTools", () => {
  it("returns 5 tools with correct names", () => {
    const tools = createGameTools();
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_game");
    expect(names).toContain("update_game");
    expect(names).toContain("add_formalization");
    expect(names).toContain("add_strategy");
    expect(names).toContain("set_payoff");
  });
});

describe("add_game", () => {
  const tools = createGameTools();
  const addGame = tools.find((t) => t.name === "add_game")!;

  it("creates a game entity in canonical.games", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addGame.execute(
      { name: "US-China Trade War" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;

    const store = getStore();
    expect(Object.keys(store.games)).toHaveLength(1);
    const game = Object.values(store.games)[0]!;
    expect(game.name).toBe("US-China Trade War");
    expect(game.status).toBe("active");
  });

  it("applies canonical_game_type and move_order when provided", async () => {
    const { context, getStore } = makeTestContext();

    await addGame.execute(
      {
        name: "Tariff Bargaining",
        canonical_game_type: "bargaining",
        move_order: "sequential",
        status: "active",
      },
      context,
    );

    const store = getStore();
    const game = Object.values(store.games)[0]!;
    expect(game.canonical_game_type).toBe("bargaining");
    expect(game.move_order).toBe("sequential");
  });

  it("rejects missing name", async () => {
    const { context } = makeTestContext();
    const result = (await addGame.execute({}, context)) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("update_game", () => {
  const tools = createGameTools();
  const addGame = tools.find((t) => t.name === "add_game")!;
  const updateGame = tools.find((t) => t.name === "update_game")!;

  it("updates game status", async () => {
    const { context, getStore } = makeTestContext();

    const addResult = (await addGame.execute(
      { name: "Test Game" },
      context,
    )) as ToolResult;
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const gameId = (addResult.data as { id: string }).id;

    const updateResult = (await updateGame.execute(
      { id: gameId, status: "resolved" },
      context,
    )) as ToolResult;

    expect(updateResult.success).toBe(true);
    const store = getStore();
    const game = store.games[gameId]!;
    expect(game.status).toBe("resolved");
  });

  it("rejects missing id", async () => {
    const { context } = makeTestContext();
    const result = (await updateGame.execute(
      { status: "resolved" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_formalization", () => {
  const tools = createGameTools();
  const addGame = tools.find((t) => t.name === "add_game")!;
  const addFormalization = tools.find((t) => t.name === "add_formalization")!;

  it("creates a formalization and attaches it to the game", async () => {
    const { context, getStore } = makeTestContext();

    const gameResult = (await addGame.execute(
      { name: "PD Game" },
      context,
    )) as ToolResult;
    expect(gameResult.success).toBe(true);
    if (!gameResult.success) return;
    const gameId = (gameResult.data as { id: string }).id;

    const formResult = (await addFormalization.execute(
      { game_id: gameId, kind: "normal_form", purpose: "explanatory" },
      context,
    )) as ToolResult;

    expect(formResult.success).toBe(true);

    const store = getStore();
    expect(Object.keys(store.formalizations)).toHaveLength(1);
    const formId = (formResult.data as { id: string }).id;
    const game = store.games[gameId]!;
    expect(game.formalizations).toContain(formId);
  });

  it("fails if game does not exist", async () => {
    const { context } = makeTestContext();
    const result = (await addFormalization.execute(
      { game_id: "nonexistent-id", kind: "normal_form" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("does not exist");
  });

  it("rejects missing game_id", async () => {
    const { context } = makeTestContext();
    const result = (await addFormalization.execute({}, context)) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_strategy", () => {
  const tools = createGameTools();
  const addGame = tools.find((t) => t.name === "add_game")!;
  const addFormalization = tools.find((t) => t.name === "add_formalization")!;
  const addStrategy = tools.find((t) => t.name === "add_strategy")!;

  it("adds a strategy to a normal-form formalization", async () => {
    const { context, getStore } = makeTestContext();

    const gameResult = (await addGame.execute(
      { name: "PD" },
      context,
    )) as ToolResult;
    if (!gameResult.success) return;
    const gameId = (gameResult.data as { id: string }).id;

    const formResult = (await addFormalization.execute(
      { game_id: gameId },
      context,
    )) as ToolResult;
    if (!formResult.success) return;
    const formId = (formResult.data as { id: string }).id;

    const stratResult = (await addStrategy.execute(
      {
        formalization_id: formId,
        player_id: "player_1",
        strategy_label: "Cooperate",
      },
      context,
    )) as ToolResult;

    expect(stratResult.success).toBe(true);

    const store = getStore();
    const form = store.formalizations[formId]!;
    if (form.kind !== "normal_form") return;
    expect(form.strategies["player_1"]).toContain("Cooperate");
  });

  it("rejects missing required fields", async () => {
    const { context } = makeTestContext();
    const result = (await addStrategy.execute(
      { formalization_id: "x" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("set_payoff", () => {
  const tools = createGameTools();
  const addGame = tools.find((t) => t.name === "add_game")!;
  const addFormalization = tools.find((t) => t.name === "add_formalization")!;
  const addStrategy = tools.find((t) => t.name === "add_strategy")!;
  const setPayoff = tools.find((t) => t.name === "set_payoff")!;

  it("sets a payoff in a matching strategy profile", async () => {
    const { context, getStore } = makeTestContext();

    const gameResult = (await addGame.execute(
      { name: "PD" },
      context,
    )) as ToolResult;
    if (!gameResult.success) return;
    const gameId = (gameResult.data as { id: string }).id;

    const formResult = (await addFormalization.execute(
      { game_id: gameId },
      context,
    )) as ToolResult;
    if (!formResult.success) return;
    const formId = (formResult.data as { id: string }).id;

    await addStrategy.execute(
      { formalization_id: formId, player_id: "p1", strategy_label: "C" },
      context,
    );
    await addStrategy.execute(
      { formalization_id: formId, player_id: "p2", strategy_label: "D" },
      context,
    );

    const payoffResult = (await setPayoff.execute(
      {
        formalization_id: formId,
        strategy_profile: { p1: "C", p2: "D" },
        player_id: "p1",
        value: -1,
        rationale: "Sucker payoff",
      },
      context,
    )) as ToolResult;

    expect(payoffResult.success).toBe(true);

    const store = getStore();
    const form = store.formalizations[formId]!;
    if (form.kind !== "normal_form") return;
    const cell = form.payoff_cells.find(
      (c) =>
        c.strategy_profile["p1"] === "C" && c.strategy_profile["p2"] === "D",
    );
    expect(cell).toBeDefined();
    expect(cell?.payoffs["p1"]?.value).toBe(-1);
  });

  it("fails if formalization does not exist", async () => {
    const { context } = makeTestContext();
    const result = (await setPayoff.execute(
      {
        formalization_id: "nonexistent",
        strategy_profile: { p1: "C" },
        player_id: "p1",
        value: 1,
      },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("does not exist");
  });

  it("fails if strategy not in profile", async () => {
    const { context } = makeTestContext();

    const gameResult = (await addGame.execute(
      { name: "G" },
      context,
    )) as ToolResult;
    if (!gameResult.success) return;
    const gameId = (gameResult.data as { id: string }).id;

    const formResult = (await addFormalization.execute(
      { game_id: gameId },
      context,
    )) as ToolResult;
    if (!formResult.success) return;
    const formId = (formResult.data as { id: string }).id;

    await addStrategy.execute(
      { formalization_id: formId, player_id: "p1", strategy_label: "A" },
      context,
    );

    const result = (await setPayoff.execute(
      {
        formalization_id: formId,
        strategy_profile: { p1: "Z" },
        player_id: "p1",
        value: 5,
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("not valid");
  });
});
