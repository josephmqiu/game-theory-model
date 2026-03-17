import { describe, it, expect, vi } from "vitest";
import { runAgentLoop } from "./loop";
import type { AgentLoopDeps } from "./loop";
import type { AgentLoopConfig } from "../types/agent";
import { createToolRegistry } from "../tools/registry";
import { createEvidenceTools } from "../tools/evidence-tools";
import { createPlayerTools } from "../tools/player-tools";
import { createGetAnalysisStatusTool } from "../tools/analysis-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, AgentEvent, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

// ── Test context factory ───────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxIterations: 20,
  inactivityTimeoutMs: 60_000,
  enableWebSearch: false,
};

async function* singleEvent(event: AgentEvent): AsyncGenerator<AgentEvent> {
  yield event;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("agent loop integration", () => {
  it("agent creates evidence and players through tool calls", async () => {
    const registry = createToolRegistry();

    createEvidenceTools().forEach((t) => registry.register(t));
    createPlayerTools().forEach((t) => registry.register(t));
    registry.register(createGetAnalysisStatusTool());

    const { context, getStore } = makeTestContext();

    // Track created IDs so subsequent iterations can reference them
    let createdSourceId: string | undefined;
    let createdPlayerId: string | undefined;

    const events: AgentEvent[] = [];

    const callProvider = vi.fn(
      (iteration: number): AsyncGenerator<AgentEvent> => {
        if (iteration === 0) {
          return singleEvent({
            type: "tool_call",
            id: "call_1",
            name: "add_source",
            input: { title: "Reuters" },
          });
        }

        if (iteration === 1) {
          return singleEvent({
            type: "tool_call",
            id: "call_2",
            name: "add_player",
            input: { name: "United States", type: "state", role: "primary" },
          });
        }

        if (iteration === 2) {
          return singleEvent({
            type: "tool_call",
            id: "call_3",
            name: "get_analysis_status",
            input: {},
          });
        }

        // Iteration 3: text only → loop ends
        return singleEvent({
          type: "text",
          content: "Analysis started with 1 source and 1 player.",
        });
      },
    );

    const executeTool = async (
      name: string,
      input: Record<string, unknown>,
    ): Promise<ToolResult> => {
      const tool = registry.get(name);
      if (!tool) {
        return { success: false, error: `Tool not found: ${name}` };
      }
      const result = await tool.execute(input, context);

      // Capture IDs for reference in later iterations
      if (result.success && name === "add_source") {
        createdSourceId = (result.data as { id: string }).id;
      }
      if (result.success && name === "add_player") {
        createdPlayerId = (result.data as { id: string }).id;
      }

      return result;
    };

    const deps: AgentLoopDeps = {
      callProvider,
      executeTool,
      onEvent: (event) => events.push(event),
      config: DEFAULT_CONFIG,
    };

    const abortController = new AbortController();
    await runAgentLoop(deps, abortController.signal);

    // Assert canonical store has 1 source and 1 player
    const finalStore = getStore();
    expect(Object.keys(finalStore.sources)).toHaveLength(1);
    expect(Object.keys(finalStore.players)).toHaveLength(1);

    const source = Object.values(finalStore.sources)[0]!;
    expect(source.title).toBe("Reuters");

    const player = Object.values(finalStore.players)[0]!;
    expect(player.name).toBe("United States");
    expect(player.type).toBe("state");

    // Assert events include tool_call, tool_result, and text events
    const toolCallEvents = events.filter((e) => e.type === "tool_call");
    const toolResultEvents = events.filter((e) => e.type === "tool_result");
    const textEvents = events.filter((e) => e.type === "text");
    const doneEvents = events.filter((e) => e.type === "done");

    expect(toolCallEvents.length).toBeGreaterThanOrEqual(1);
    expect(toolResultEvents.length).toBeGreaterThanOrEqual(1);
    expect(textEvents.length).toBeGreaterThanOrEqual(1);

    // Final event is `done`
    expect(doneEvents).toHaveLength(1);
    expect(events[events.length - 1]!.type).toBe("done");

    // Assert the IDs were captured (tools executed successfully)
    expect(createdSourceId).toBeDefined();
    expect(createdPlayerId).toBeDefined();
  });

  it("agent loop stops at maxIterations", async () => {
    const events: AgentEvent[] = [];

    // Provider always returns a tool call — but the tool registry is empty,
    // so executeTool will return an error. The loop should stop after maxIterations.
    const callProvider = (_iteration: number): AsyncGenerator<AgentEvent> =>
      singleEvent({
        type: "tool_call",
        id: "call_infinite",
        name: "nonexistent_tool",
        input: {},
      });

    const executeTool = async (
      _name: string,
      _input: Record<string, unknown>,
    ): Promise<ToolResult> => ({
      success: false,
      error: "Tool not found",
    });

    const deps: AgentLoopDeps = {
      callProvider,
      executeTool,
      onEvent: (event) => events.push(event),
      config: {
        maxIterations: 2,
        inactivityTimeoutMs: 60_000,
        enableWebSearch: false,
      },
    };

    const abortController = new AbortController();
    await runAgentLoop(deps, abortController.signal);

    // Should have called provider exactly maxIterations times (0 and 1),
    // then emitted the iteration-limit text and done.
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);

    const textEvents = events.filter(
      (e) => e.type === "text" && e.content.includes("iteration limit"),
    );
    expect(textEvents).toHaveLength(1);

    // Total tool calls should be exactly 2 (one per iteration before stopping)
    const toolCallEvents = events.filter((e) => e.type === "tool_call");
    expect(toolCallEvents).toHaveLength(2);
  });
});
