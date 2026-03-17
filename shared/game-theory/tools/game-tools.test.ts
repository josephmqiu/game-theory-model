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
  it("returns 2 tools with correct names", () => {
    const tools = createGameTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_game");
    expect(names).toContain("update_game");
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
