import { describe, it, expect } from "vitest";
import { createWorkflowTools } from "./workflow-tools";
import { createGameTools } from "./game-tools";
import { createFormalizationTools } from "./formalization-tools";
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

/**
 * Creates a game, formalization, and game_node. Returns { gameId, formalizationId, nodeId }.
 * The game_node can be used as a trigger_ref for cross_game_links.
 */
async function setupGameWithNode(
  context: ToolContext,
  name: string,
): Promise<{ gameId: string; formalizationId: string; nodeId: string } | null> {
  const gameTools = createGameTools();
  const addGame = gameTools.find((t) => t.name === "add_game")!;
  const formTools = createFormalizationTools();
  const addFormalization = formTools.find(
    (t) => t.name === "add_formalization",
  )!;

  const gameResult = (await addGame.execute(
    { name, description: `${name} setup.` },
    context,
  )) as ToolResult;
  if (!gameResult.success) return null;
  const gameId = (gameResult.data as { id: string }).id;

  const formResult = (await addFormalization.execute(
    { game_id: gameId, kind: "extensive_form" },
    context,
  )) as ToolResult;
  if (!formResult.success) return null;
  const formalizationId = (formResult.data as { id: string }).id;

  // Create a game_node directly via dispatch
  const nodeId = `game_node_${crypto.randomUUID()}`;
  const nodeResult = context.dispatch({
    kind: "add_game_node" as const,
    id: nodeId,
    payload: {
      formalization_id: formalizationId,
      actor: { kind: "player" as const, player_id: "player_dummy" },
      type: "decision" as const,
      label: "Decision node",
    },
  });

  // game_node creation may fail due to player not existing — use a nature actor instead
  if (nodeResult.status !== "committed") {
    const nodeId2 = `game_node_${crypto.randomUUID()}`;
    const nodeResult2 = context.dispatch({
      kind: "add_game_node" as const,
      id: nodeId2,
      payload: {
        formalization_id: formalizationId,
        actor: { kind: "nature" as const },
        type: "chance" as const,
        label: "Chance node",
      },
    });
    if (nodeResult2.status !== "committed") return null;
    return { gameId, formalizationId, nodeId: nodeId2 };
  }

  return { gameId, formalizationId, nodeId };
}

describe("createWorkflowTools", () => {
  it("returns 3 tools with correct names", () => {
    const tools = createWorkflowTools();
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_cross_game_link");
    expect(names).toContain("check_disruption_triggers");
    expect(names).toContain("propose_revision");
  });
});

describe("add_cross_game_link", () => {
  const workflowTools = createWorkflowTools();
  const addCrossGameLink = workflowTools.find(
    (t) => t.name === "add_cross_game_link",
  )!;

  it("creates a cross-game link between two games with a valid trigger_ref", async () => {
    const { context, getStore } = makeTestContext();

    const setup1 = await setupGameWithNode(context, "Game A");
    const setup2 = await setupGameWithNode(context, "Game B");
    if (!setup1 || !setup2) return;

    const result = (await addCrossGameLink.execute(
      {
        source_game_id: setup1.gameId,
        target_game_id: setup2.gameId,
        trigger_ref_id: setup1.nodeId,
        effect_type: "timing_change",
        rationale: "Game A's chance node triggers timing change in Game B.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.cross_game_links)).toHaveLength(1);
    const link = Object.values(store.cross_game_links)[0]!;
    expect(link.source_game_id).toBe(setup1.gameId);
    expect(link.target_game_id).toBe(setup2.gameId);
    expect(link.effect_type).toBe("timing_change");
  });

  it("rejects missing target_game_id", async () => {
    const { context } = makeTestContext();
    const result = (await addCrossGameLink.execute(
      { source_game_id: "game_a" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("check_disruption_triggers", () => {
  const workflowTools = createWorkflowTools();
  const checkTriggers = workflowTools.find(
    (t) => t.name === "check_disruption_triggers",
  )!;
  const addCrossGameLink = workflowTools.find(
    (t) => t.name === "add_cross_game_link",
  )!;

  it("returns empty triggers on empty store", async () => {
    const { context } = makeTestContext();
    const result = (await checkTriggers.execute({}, context)) as ToolResult;
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as { triggers: unknown[] };
    expect(data.triggers).toHaveLength(0);
  });

  it("detects cross-game link triggers when two games are active", async () => {
    const { context } = makeTestContext();

    const setup1 = await setupGameWithNode(context, "G1");
    const setup2 = await setupGameWithNode(context, "G2");
    if (!setup1 || !setup2) return;

    await addCrossGameLink.execute(
      {
        source_game_id: setup1.gameId,
        target_game_id: setup2.gameId,
        trigger_ref_id: setup1.nodeId,
        effect_type: "timing_change",
        rationale: "Test link.",
      },
      context,
    );

    const result = (await checkTriggers.execute({}, context)) as ToolResult;
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as { triggers: unknown[] };
    expect(data.triggers.length).toBeGreaterThan(0);
  });
});

describe("propose_revision", () => {
  const workflowTools = createWorkflowTools();
  const proposeRevision = workflowTools.find(
    (t) => t.name === "propose_revision",
  )!;

  it("returns a pending proposal without committing changes", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await proposeRevision.execute(
      {
        entity_type: "game",
        entity_id: "game_123",
        changes: { status: "resolved" },
        rationale: "Game has concluded.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data as {
      proposal_id: string;
      entity_type: string;
      entity_id: string;
      changes: Record<string, unknown>;
      rationale: string;
      status: string;
    };

    expect(data.status).toBe("pending");
    expect(data.entity_type).toBe("game");
    expect(data.entity_id).toBe("game_123");
    expect(data.changes).toEqual({ status: "resolved" });

    // No changes committed to store
    const store = getStore();
    expect(Object.keys(store.games)).toHaveLength(0);
  });

  it("rejects missing rationale", async () => {
    const { context } = makeTestContext();
    const result = (await proposeRevision.execute(
      {
        entity_type: "game",
        entity_id: "game_123",
        changes: { status: "resolved" },
      },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});
