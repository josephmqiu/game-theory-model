import { describe, it, expect } from "vitest";
import { createPlayerTools } from "./player-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

// ── Test context factory ──────────────────────────────────────────────────────

interface TestContext {
  context: ToolContext;
  getStore: () => CanonicalStore;
}

function makeTestContext(): TestContext {
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

describe("createPlayerTools", () => {
  it("returns 4 tools with correct names", () => {
    const tools = createPlayerTools();
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_player");
    expect(names).toContain("update_player");
    expect(names).toContain("add_player_objective");
    expect(names).toContain("update_information_state");
  });
});

describe("add_player", () => {
  const tools = createPlayerTools();
  const addPlayer = tools.find((t) => t.name === "add_player")!;

  it("creates a player entity in canonical.players", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addPlayer.execute(
      { name: "United States" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;

    const store = getStore();
    expect(Object.keys(store.players)).toHaveLength(1);

    const player = Object.values(store.players)[0]!;
    expect(player.name).toBe("United States");
    expect(player.type).toBe("individual");
    expect(player.objectives).toEqual([]);
    expect(player.constraints).toEqual([]);
  });

  it("applies type and role when provided", async () => {
    const { context, getStore } = makeTestContext();

    await addPlayer.execute(
      { name: "China", type: "state", role: "primary" },
      context,
    );

    const store = getStore();
    const player = Object.values(store.players)[0]!;
    expect(player.type).toBe("state");
    expect(player.role).toBe("primary");
  });

  it("creates objectives with default weights when provided", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addPlayer.execute(
      {
        name: "EU",
        type: "organization",
        objectives: [
          {
            label: "Maintain market stability",
            description: "Preserve internal market.",
          },
          { label: "Limit tariff escalation" },
        ],
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    const player = Object.values(store.players)[0]!;
    expect(player.objectives).toHaveLength(2);
    expect(player.objectives[0]!.label).toBe("Maintain market stability");
    expect(player.objectives[0]!.description).toBe("Preserve internal market.");
    expect(player.objectives[1]!.label).toBe("Limit tariff escalation");
  });

  it("creates constraints when provided", async () => {
    const { context, getStore } = makeTestContext();

    await addPlayer.execute(
      {
        name: "Germany",
        type: "state",
        constraints: [
          { label: "WTO obligations", type: "legal", severity: "hard" },
        ],
      },
      context,
    );

    const store = getStore();
    const player = Object.values(store.players)[0]!;
    expect(player.constraints).toHaveLength(1);
    expect(player.constraints[0]!.label).toBe("WTO obligations");
    expect(player.constraints[0]!.severity).toBe("hard");
  });

  it("rejects missing name", async () => {
    const { context } = makeTestContext();

    const result = (await addPlayer.execute({}, context)) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("update_player", () => {
  const tools = createPlayerTools();
  const addPlayer = tools.find((t) => t.name === "add_player")!;
  const updatePlayer = tools.find((t) => t.name === "update_player")!;

  it("modifies an existing player's name", async () => {
    const { context, getStore } = makeTestContext();

    const addResult = (await addPlayer.execute(
      { name: "Russia", type: "state" },
      context,
    )) as ToolResult;
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const playerId = (addResult.data as { id: string }).id;

    const updateResult = (await updatePlayer.execute(
      { id: playerId, name: "Russian Federation" },
      context,
    )) as ToolResult;

    expect(updateResult.success).toBe(true);

    const store = getStore();
    const player = store.players[playerId]!;
    expect(player.name).toBe("Russian Federation");
    expect(player.type).toBe("state");
  });

  it("modifies an existing player's type and role", async () => {
    const { context, getStore } = makeTestContext();

    const addResult = (await addPlayer.execute(
      { name: "NATO", type: "organization" },
      context,
    )) as ToolResult;
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const playerId = (addResult.data as { id: string }).id;

    await updatePlayer.execute({ id: playerId, role: "gatekeeper" }, context);

    const store = getStore();
    const player = store.players[playerId]!;
    expect(player.name).toBe("NATO");
    expect(player.role).toBe("gatekeeper");
  });

  it("rejects missing id", async () => {
    const { context } = makeTestContext();

    const result = (await updatePlayer.execute(
      { name: "Some Player" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });

  it("rejects update for non-existent player", async () => {
    const { context } = makeTestContext();

    const result = (await updatePlayer.execute(
      { id: "player_nonexistent", name: "Ghost" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
  });
});
