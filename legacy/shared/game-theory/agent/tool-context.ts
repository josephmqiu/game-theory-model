/**
 * Factory for creating a server-side ToolContext backed by real dispatch.
 *
 * The context holds a mutable working copy of the canonical store so that
 * successive tool calls within one agent turn each see the results of the
 * previous tool call. After the agent session the caller can inspect the
 * accumulated list of dispatched commands and attach them to SSE events so
 * the client can replay them through its own command spine.
 */

import { dispatch as engineDispatch } from "shared/game-theory/engine/dispatch";
import { createEventLog } from "shared/game-theory/engine/events";
import type { EventLog } from "shared/game-theory/engine/events";
import type { Command } from "shared/game-theory/engine/commands";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import type { ToolContext } from "shared/game-theory/types/agent";

export interface AgentToolContextHandle {
  /** The live ToolContext — pass this to tool.execute() calls. */
  context: ToolContext;
  /**
   * Returns all commands that were successfully committed since the last call
   * to clearLastDispatchedCommands (or since creation).
   */
  getLastDispatchedCommands: () => Command[];
  /**
   * Clears the tracked command list. Call this at the start of each tool
   * execution so the list only contains commands from the current tool call.
   */
  clearLastDispatchedCommands: () => void;
}

export interface CreateAgentToolContextParams {
  /** Canonical store snapshot sent by the client. Defaults to empty store. */
  canonical?: CanonicalStore;
  /**
   * The persisted-revision cursor from the client's event log. Used to
   * initialise the server-side event log so revision numbers stay in sync.
   * Defaults to 0.
   */
  eventLogCursor?: number;
}

export function createAgentToolContext(
  params: CreateAgentToolContextParams = {},
): AgentToolContextHandle {
  let serverCanonical: CanonicalStore =
    params.canonical ?? emptyCanonicalStore();
  let serverEventLog: EventLog = createEventLog(
    "agent-session",
    params.eventLogCursor ?? 0,
  );
  let lastDispatchedCommands: Command[] = [];

  const context: ToolContext = {
    get canonical() {
      return serverCanonical;
    },
    dispatch(command: Command) {
      const result = engineDispatch(serverCanonical, serverEventLog, command, {
        source: "ai_merge",
      });
      if (result.status === "committed") {
        serverCanonical = result.store;
        serverEventLog = result.event_log;
        lastDispatchedCommands = [...lastDispatchedCommands, command];
      }
      return result;
    },
    // Phase 4 will wire this to the real analysis pipeline state
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
    getLastDispatchedCommands: () => [...lastDispatchedCommands],
    clearLastDispatchedCommands: () => {
      lastDispatchedCommands = [];
    },
  };
}
