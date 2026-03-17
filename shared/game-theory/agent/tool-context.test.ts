import { describe, it, expect } from "vitest";
import { createAgentToolContext } from "./tool-context";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import type { Command } from "shared/game-theory/engine/commands";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAddPlayerCommand(name: string): Command {
  return {
    kind: "add_player",
    payload: {
      name,
      type: "state",
      role: "primary",
      objectives: [],
      constraints: [],
    },
  };
}

function makeAddSourceCommand(title: string): Command {
  return {
    kind: "add_source",
    payload: {
      kind: "article",
      title,
      captured_at: new Date().toISOString(),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createAgentToolContext", () => {
  it("returns a context with canonical getter that reflects the initial store", () => {
    const { context } = createAgentToolContext();
    expect(context.canonical).toEqual(emptyCanonicalStore());
  });

  it("uses provided canonical store instead of empty store", () => {
    const baseCanonical: CanonicalStore = {
      ...emptyCanonicalStore(),
      games: { "g-1": { id: "g-1", name: "Test Game" } as never },
    };
    const { context } = createAgentToolContext({ canonical: baseCanonical });
    expect(context.canonical.games["g-1"]).toBeDefined();
    expect(context.canonical.games["g-1"]!.name).toBe("Test Game");
  });

  it("dispatch commits a command and updates canonical", () => {
    const { context } = createAgentToolContext();
    const command = makeAddPlayerCommand("US");

    const result = context.dispatch(command);

    expect(result.status).toBe("committed");
    const players = Object.values(context.canonical.players);
    expect(players).toHaveLength(1);
    expect(players[0]!.name).toBe("US");
  });

  it("canonical getter always returns the latest store after dispatch", () => {
    const { context } = createAgentToolContext();

    const before = context.canonical;
    expect(Object.keys(before.players)).toHaveLength(0);

    context.dispatch(makeAddPlayerCommand("China"));

    // The getter reflects the updated store — not the stale reference
    const after = context.canonical;
    expect(Object.keys(after.players)).toHaveLength(1);

    // The old reference is unchanged (immutability)
    expect(Object.keys(before.players)).toHaveLength(0);
  });

  it("successive dispatches are visible to subsequent reads", () => {
    const { context } = createAgentToolContext();

    context.dispatch(makeAddPlayerCommand("US"));
    context.dispatch(makeAddPlayerCommand("Russia"));
    context.dispatch(makeAddSourceCommand("Reuters"));

    expect(Object.keys(context.canonical.players)).toHaveLength(2);
    expect(Object.keys(context.canonical.sources)).toHaveLength(1);
  });

  it("getLastDispatchedCommands returns committed commands", () => {
    const { context, getLastDispatchedCommands } = createAgentToolContext();

    const cmd1 = makeAddPlayerCommand("US");
    const cmd2 = makeAddSourceCommand("Reuters");

    context.dispatch(cmd1);
    context.dispatch(cmd2);

    const commands = getLastDispatchedCommands();
    expect(commands).toHaveLength(2);
    expect(commands[0]!.kind).toBe("add_player");
    expect(commands[1]!.kind).toBe("add_source");
  });

  it("clearLastDispatchedCommands resets the tracked list", () => {
    const { context, getLastDispatchedCommands, clearLastDispatchedCommands } =
      createAgentToolContext();

    context.dispatch(makeAddPlayerCommand("US"));
    expect(getLastDispatchedCommands()).toHaveLength(1);

    clearLastDispatchedCommands();
    expect(getLastDispatchedCommands()).toHaveLength(0);

    // Dispatching after clear only accumulates new commands
    context.dispatch(makeAddSourceCommand("BBC"));
    expect(getLastDispatchedCommands()).toHaveLength(1);
    expect(getLastDispatchedCommands()[0]!.kind).toBe("add_source");
  });

  it("getLastDispatchedCommands returns a snapshot — mutations do not affect internal state", () => {
    const { context, getLastDispatchedCommands } = createAgentToolContext();

    context.dispatch(makeAddPlayerCommand("US"));

    const snapshot = getLastDispatchedCommands();
    snapshot.push({ kind: "add_player", payload: {} } as never);

    // Internal list is unchanged
    expect(getLastDispatchedCommands()).toHaveLength(1);
  });

  it("rejected dispatch does not update canonical or command list", () => {
    const { context, getLastDispatchedCommands } = createAgentToolContext();

    // A delete command for an entity that doesn't exist will be rejected
    const badCommand: Command = {
      kind: "delete_player",
      payload: { id: "nonexistent-id" },
    };

    const result = context.dispatch(badCommand);

    // Should not be committed (rejected or error)
    expect(result.status).not.toBe("committed");
    expect(Object.keys(context.canonical.players)).toHaveLength(0);
    expect(getLastDispatchedCommands()).toHaveLength(0);
  });

  it("getAnalysisState returns null (Phase 4 placeholder)", () => {
    const { context } = createAgentToolContext();
    expect(context.getAnalysisState()).toBeNull();
  });

  it("getDerivedState returns empty shape", () => {
    const { context } = createAgentToolContext();
    const derived = context.getDerivedState();
    expect(derived.readinessReportsByFormalization).toEqual({});
    expect(derived.solverResultsByFormalization).toEqual({});
    expect(derived.sensitivityByFormalizationAndSolver).toEqual({});
    expect(derived.dirtyFormalizations).toEqual({});
  });
});
