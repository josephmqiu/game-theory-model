import { describe, it, expect } from "vitest";
import { createReadTools } from "./read-tools";
import { createGameTools } from "./game-tools";
import { createAssumptionTools } from "./assumption-tools";
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

describe("createReadTools", () => {
  it("returns 2 tools with correct names", () => {
    const tools = createReadTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("get_entity");
    expect(names).toContain("list_entities");
  });
});

describe("get_entity", () => {
  const readTools = createReadTools();
  const gameTools = createGameTools();
  const getEntity = readTools.find((t) => t.name === "get_entity")!;
  const addGame = gameTools.find((t) => t.name === "add_game")!;

  it("retrieves an existing game by id", async () => {
    const { context } = makeTestContext();

    const addResult = (await addGame.execute(
      { name: "Test Game" },
      context,
    )) as ToolResult;
    if (!addResult.success) return;
    const gameId = (addResult.data as { id: string }).id;

    const result = (await getEntity.execute(
      { type: "game", id: gameId },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;
    const game = result.data as { name: string };
    expect(game.name).toBe("Test Game");
  });

  it("returns error when entity not found", async () => {
    const { context } = makeTestContext();

    const result = (await getEntity.execute(
      { type: "game", id: "nonexistent-id" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("not found");
  });

  it("rejects invalid entity type", async () => {
    const { context } = makeTestContext();

    const result = (await getEntity.execute(
      { type: "invalid_type", id: "some-id" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("list_entities", () => {
  const readTools = createReadTools();
  const assumptionTools = createAssumptionTools();
  const listEntities = readTools.find((t) => t.name === "list_entities")!;
  const addAssumption = assumptionTools.find(
    (t) => t.name === "add_assumption",
  )!;

  it("lists all entities of a given type", async () => {
    const { context } = makeTestContext();

    await addAssumption.execute({ statement: "Assumption one." }, context);
    await addAssumption.execute({ statement: "Assumption two." }, context);

    const result = (await listEntities.execute(
      { type: "assumption" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data as {
      type: string;
      items: unknown[];
      count: number;
    };
    expect(data.type).toBe("assumption");
    expect(data.count).toBe(2);
    expect(data.items).toHaveLength(2);
  });

  it("returns empty list when no entities of that type exist", async () => {
    const { context } = makeTestContext();

    const result = (await listEntities.execute(
      { type: "player" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as { count: number };
    expect(data.count).toBe(0);
  });

  it("rejects invalid entity type", async () => {
    const { context } = makeTestContext();

    const result = (await listEntities.execute(
      { type: "not_a_real_type" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});
