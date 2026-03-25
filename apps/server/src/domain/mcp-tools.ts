/**
 * MCP tool definitions and handlers for the game-theory analysis domain.
 *
 * This module defines tool schemas (JSON Schema) and handler functions that
 * delegate to domain services (EntityGraphService, AnalysisTools). It is the
 * single source of truth for what tools the AI can call during analysis and
 * chat sessions.
 *
 * Tool handlers return plain JSON objects (not Effect types) so they can be
 * consumed directly by MCP or by the Claude adapter's canUseTool callback.
 *
 * @module mcp-tools
 */
import type { MethodologyPhase } from "./types/methodology";
import { PHASE_NUMBERS } from "./types/methodology";
import type { RelationshipType } from "./types/entity";
import {
  createEntity,
  updateEntity,
  removeEntity,
  createRelationship,
  removeRelationship,
  getStaleEntityIds,
  getAnalysis,
} from "./entity-graph-service";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
} from "./analysis-tools";
import * as orchestrator from "./analysis-orchestrator";
import * as revalidationService from "./revalidation-service";
import * as runtimeStatus from "./runtime-status";

// ── Tool Schema Types ──

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolMode = "analysis" | "chat";

// ── Read-Only Tool Definitions ──

const READ_ONLY_TOOLS: readonly ToolDefinition[] = [
  {
    name: "get_entity",
    description: "Get a single analysis entity by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to fetch" },
      },
      required: ["id"],
    },
  },
  {
    name: "query_entities",
    description: "Query analysis entities by phase, type, or stale status.",
    inputSchema: {
      type: "object",
      properties: {
        phase: {
          type: "string",
          description:
            "Filter by methodology phase (e.g. situational-grounding)",
        },
        type: {
          type: "string",
          description: "Filter by entity type (e.g. fact, player, objective)",
        },
        stale: {
          type: "boolean",
          description: "Filter by stale status",
        },
      },
      required: [],
    },
  },
  {
    name: "query_relationships",
    description: "Query analysis relationships by type or entity involvement.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Filter by relationship type (e.g. supports, contradicts, plays-in)",
        },
        entityId: {
          type: "string",
          description: "Filter to relationships involving this entity",
        },
      },
      required: [],
    },
  },
  {
    name: "get_analysis_status",
    description: "Get the current status of the active analysis.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
] as const;

// ── Mutation Tool Definitions ──

const MUTATION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "create_entity",
    description:
      "Create a new analysis entity with AI provenance. Returns the full entity including server-generated ID.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Entity type: fact, player, objective, game, strategy, payoff, institutional-rule, escalation-rung",
        },
        phase: {
          type: "string",
          description: "Methodology phase this entity belongs to",
        },
        data: {
          type: "object",
          description: "Entity-type-specific data",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Confidence level",
        },
        rationale: {
          type: "string",
          description: "Reasoning for this entity",
        },
        revision: {
          type: "number",
          description: "Revision number (default 1)",
        },
      },
      required: ["type", "phase", "data"],
    },
  },
  {
    name: "update_entity",
    description:
      "Update an existing analysis entity. Chains provenance with previousOrigin.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to update" },
        updates: {
          type: "object",
          description:
            "Updated entity fields to merge into the existing entity",
        },
      },
      required: ["id", "updates"],
    },
  },
  {
    name: "delete_entity",
    description:
      "Delete an analysis entity by ID. Cascade-deletes associated relationships.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_relationship",
    description:
      "Create a relationship between two analysis entities. Both entity IDs must exist.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Relationship type: plays-in, has-objective, conflicts-with, has-strategy, supports, contradicts, produces, depends-on, invalidated-by, constrains, escalates-to, links, precedes, informed-by, derived-from",
        },
        fromId: { type: "string", description: "Source entity ID" },
        toId: { type: "string", description: "Target entity ID" },
        metadata: {
          type: "object",
          description: "Optional metadata for the relationship",
        },
      },
      required: ["type", "fromId", "toId"],
    },
  },
  {
    name: "delete_relationship",
    description: "Delete a relationship between two analysis entities by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Relationship ID to delete" },
      },
      required: ["id"],
    },
  },
] as const;

// ── Signal Tool Definitions (analysis mode only) ──

const SIGNAL_TOOLS: readonly ToolDefinition[] = [
  {
    name: "request_loopback",
    description:
      "Record a methodology disruption trigger for orchestrator loopback handling.",
    inputSchema: {
      type: "object",
      properties: {
        trigger_type: {
          type: "string",
          description: "Methodology disruption trigger type",
        },
        justification: {
          type: "string",
          description: "Why this trigger should cause a loopback",
        },
      },
      required: ["trigger_type", "justification"],
    },
  },
] as const;

// ── Control Tool Definitions (chat mode only) ──

const CONTROL_TOOLS: readonly ToolDefinition[] = [
  {
    name: "start_analysis",
    description:
      "Start a new game-theoretic analysis of a real-world topic. Returns a run ID for tracking progress.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The real-world topic to analyze",
        },
        provider: {
          type: "string",
          description:
            "AI provider to use for the analysis (e.g. anthropic, openai).",
        },
        model: {
          type: "string",
          description:
            "Model ID to use for the analysis (e.g. claude-sonnet-4-20250514, gpt-4o).",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "abort_analysis",
    description: "Abort the currently running analysis job, if one exists.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "rerun_phases",
    description:
      "Trigger revalidation from the earliest specified methodology phase.",
    inputSchema: {
      type: "object",
      properties: {
        phases: {
          type: "array",
          items: { type: "string" },
          description: "Methodology phases to rerun",
        },
      },
      required: ["phases"],
    },
  },
] as const;

// ── Composite Tool Lists by Mode ──

/**
 * Tools available in analysis mode:
 * - Read-only tools
 * - Mutation tools (AI creates entities during analysis)
 * - Signal tools (request_loopback)
 * - Control tools are BLOCKED (the orchestrator controls lifecycle)
 */
export function getAnalysisModeTools(): readonly ToolDefinition[] {
  return [...READ_ONLY_TOOLS, ...MUTATION_TOOLS, ...SIGNAL_TOOLS];
}

/**
 * Tools available in chat mode:
 * - All tools (read-only + mutation + control + signal)
 */
export function getChatModeTools(): readonly ToolDefinition[] {
  return [
    ...READ_ONLY_TOOLS,
    ...MUTATION_TOOLS,
    ...SIGNAL_TOOLS,
    ...CONTROL_TOOLS,
  ];
}

/**
 * Get tool definitions for the specified mode.
 */
export function getToolDefinitions(mode: ToolMode): readonly ToolDefinition[] {
  return mode === "analysis" ? getAnalysisModeTools() : getChatModeTools();
}

// ── Tool Set Name Lookup ──

const CONTROL_TOOL_NAMES = new Set(CONTROL_TOOLS.map((t) => t.name));

/**
 * Check whether a tool name is allowed in the given mode.
 */
export function isToolAllowed(name: string, mode: ToolMode): boolean {
  if (mode === "chat") {
    // Chat allows everything
    return getToolDefinitions("chat").some((t) => t.name === name);
  }

  // Analysis mode: block control tools
  if (CONTROL_TOOL_NAMES.has(name)) {
    return false;
  }

  return getToolDefinitions("analysis").some((t) => t.name === name);
}

// ── Tool Call Handlers ──

/**
 * Handle a tool call by name, delegating to the appropriate domain service.
 *
 * All entity mutations set source: "ai" via the "ai-edited" provenance source.
 * Returns { text: string, isError: boolean } for MCP compatibility.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  context?: { runId?: string },
): Promise<{ text: string; isError: boolean }> {
  const toolArgs = (args ?? {}) as Record<string, unknown>;
  const runId = context?.runId;

  try {
    switch (name) {
      // ── Read-only tools ──
      case "get_entity":
        return {
          text: JSON.stringify(getEntity(toolArgs.id as string)),
          isError: false,
        };

      case "query_entities": {
        const entityFilters: {
          phase?: string;
          type?: string;
          stale?: boolean;
        } = {};
        if (toolArgs.phase !== undefined)
          entityFilters.phase = toolArgs.phase as string;
        if (toolArgs.type !== undefined)
          entityFilters.type = toolArgs.type as string;
        if (toolArgs.stale !== undefined)
          entityFilters.stale = toolArgs.stale as boolean;
        return {
          text: JSON.stringify(queryEntities(entityFilters)),
          isError: false,
        };
      }

      case "query_relationships": {
        const relFilters: { entityId?: string; type?: string } = {};
        if (toolArgs.entityId !== undefined)
          relFilters.entityId = toolArgs.entityId as string;
        if (toolArgs.type !== undefined)
          relFilters.type = toolArgs.type as string;
        return {
          text: JSON.stringify(queryRelationships(relFilters)),
          isError: false,
        };
      }

      case "get_analysis_status":
        return {
          text: handleGetAnalysisStatus(),
          isError: false,
        };

      // ── Mutation tools ──
      case "create_entity":
        return {
          text: handleCreateEntity(
            toolArgs as {
              type: string;
              phase: string;
              data: Record<string, unknown>;
              confidence?: string;
              rationale?: string;
              revision?: number;
            },
            runId,
          ),
          isError: false,
        };

      case "update_entity":
        return {
          text: handleUpdateEntity(
            toolArgs as {
              id: string;
              updates: Record<string, unknown>;
            },
            runId,
          ),
          isError: false,
        };

      case "delete_entity": {
        const deleted = removeEntity(toolArgs.id as string);
        if (!deleted) {
          return {
            text: JSON.stringify({
              error: `Entity "${toolArgs.id}" not found`,
            }),
            isError: false,
          };
        }
        return {
          text: JSON.stringify({ deleted: true, id: toolArgs.id }),
          isError: false,
        };
      }

      case "create_relationship":
        return {
          text: handleCreateRelationship(
            toolArgs as {
              type: string;
              fromId: string;
              toId: string;
              metadata?: Record<string, unknown>;
            },
            runId,
          ),
          isError: false,
        };

      case "delete_relationship": {
        const deleted = removeRelationship(toolArgs.id as string);
        if (!deleted) {
          return {
            text: JSON.stringify({
              error: `Relationship "${toolArgs.id}" not found`,
            }),
            isError: false,
          };
        }
        return {
          text: JSON.stringify({ deleted: true, id: toolArgs.id }),
          isError: false,
        };
      }

      // ── Signal tools ──
      case "request_loopback":
        return {
          text: JSON.stringify(
            requestLoopback(
              toolArgs as { trigger_type: string; justification: string },
              runId,
            ),
          ),
          isError: false,
        };

      // ── Control tools ──
      case "start_analysis":
        return handleStartAnalysis(
          toolArgs as {
            topic: string;
            provider?: string;
            model?: string;
          },
        );

      case "abort_analysis":
        return handleAbortAnalysis();

      case "rerun_phases":
        return handleRerunPhases(toolArgs as { phases: string[] });

      default:
        return {
          text: `Error: Unknown tool "${name}"`,
          isError: true,
        };
    }
  } catch (error) {
    return {
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ── Private Handler Helpers ──

function handleGetAnalysisStatus(): string {
  const analysis = getAnalysis();
  const runSnapshot = runtimeStatus.getSnapshot();
  return JSON.stringify({
    id: analysis.id,
    topic: analysis.topic,
    entityCount: analysis.entities.length,
    relationshipCount: analysis.relationships.length,
    phases: analysis.phases,
    runStatus: {
      status: runSnapshot.status,
      kind: runSnapshot.kind,
      runId: runSnapshot.runId,
      activePhase: runSnapshot.activePhase,
      progress: runSnapshot.progress,
      ...(runSnapshot.failureMessage
        ? { error: runSnapshot.failureMessage }
        : {}),
    },
  });
}

async function handleStartAnalysis(args: {
  topic: string;
  provider?: string;
  model?: string;
}): Promise<{ text: string; isError: boolean }> {
  try {
    if (orchestrator.isRunning()) {
      return {
        text: JSON.stringify({
          error:
            "An analysis is already running. Abort it first or wait for it to complete.",
        }),
        isError: true,
      };
    }

    const { runId } = await orchestrator.runFull(
      args.topic,
      args.provider,
      args.model,
    );

    return {
      text: JSON.stringify({ runId, status: "started" }),
      isError: false,
    };
  } catch (error) {
    return {
      text: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

function handleAbortAnalysis(): { text: string; isError: boolean } {
  if (!orchestrator.isRunning()) {
    return {
      text: JSON.stringify({
        error: "No analysis is currently running.",
      }),
      isError: true,
    };
  }

  orchestrator.abort();
  return {
    text: JSON.stringify({ status: "aborted" }),
    isError: false,
  };
}

function handleRerunPhases(args: { phases: string[] }): {
  text: string;
  isError: boolean;
} {
  if (!args.phases || args.phases.length === 0) {
    return {
      text: JSON.stringify({
        error: "No phases specified for rerun.",
      }),
      isError: true,
    };
  }

  if (orchestrator.isRunning()) {
    return {
      text: JSON.stringify({
        error:
          "An analysis is currently running. Abort it first or wait for it to complete.",
      }),
      isError: true,
    };
  }

  // Find the earliest requested phase by methodology order
  let earliestPhase: string | null = null;
  let earliestNumber = Infinity;

  for (const phase of args.phases) {
    const phaseNum = PHASE_NUMBERS[phase as MethodologyPhase];
    if (phaseNum !== undefined && phaseNum < earliestNumber) {
      earliestNumber = phaseNum;
      earliestPhase = phase;
    }
  }

  if (!earliestPhase) {
    return {
      text: JSON.stringify({
        error: `No valid methodology phases found in: ${args.phases.join(", ")}`,
      }),
      isError: true,
    };
  }

  const { runId } = revalidationService.revalidate(undefined, earliestPhase);
  return {
    text: JSON.stringify({
      runId,
      status: "rerun_started",
      fromPhase: earliestPhase,
    }),
    isError: false,
  };
}

function handleCreateEntity(
  args: {
    type: string;
    phase: string;
    data: Record<string, unknown>;
    confidence?: string;
    rationale?: string;
    revision?: number;
  },
  runId?: string,
): string {
  const entity = createEntity(
    {
      type: args.type as never,
      phase: args.phase as MethodologyPhase,
      data: args.data as never,
      confidence: (args.confidence as never) ?? "medium",
      rationale: args.rationale ?? "",
      revision: args.revision ?? 1,
      stale: false,
    },
    { source: "ai-edited", ...(runId ? { runId } : {}) },
  );

  // Return the full entity — the AI needs the server-generated ID
  // for subsequent relationship creation
  return JSON.stringify(entity);
}

function handleUpdateEntity(
  args: {
    id: string;
    updates: Record<string, unknown>;
  },
  runId?: string,
): string {
  const staleBefore = new Set(getStaleEntityIds());
  const result = updateEntity(args.id, args.updates as never, {
    source: "ai-edited",
    ...(runId ? { runId } : {}),
  });

  if (!result) {
    return JSON.stringify({ error: `Entity "${args.id}" not found` });
  }

  const staleAfter = getStaleEntityIds();
  const newlyStale = staleAfter.filter((id) => !staleBefore.has(id));

  return JSON.stringify({
    updated: result,
    staleMarked: newlyStale,
  });
}

function handleCreateRelationship(
  args: {
    type: string;
    fromId: string;
    toId: string;
    metadata?: Record<string, unknown>;
  },
  runId?: string,
): string {
  try {
    const result = createRelationship(
      {
        type: args.type as RelationshipType,
        fromEntityId: args.fromId,
        toEntityId: args.toId,
        metadata: args.metadata,
      },
      {
        source: "ai-edited",
        ...(runId ? { runId } : {}),
      },
    );
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
