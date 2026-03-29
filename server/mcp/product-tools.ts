import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
  type AnalysisToolContext,
} from "../services/analysis-tools";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type { RelationshipType } from "../../shared/types/entity";
import * as analysisOrchestrator from "../agents/analysis-agent";
import * as revalidationService from "../services/revalidation-service";
import * as questionService from "../services/workspace/question-service";
import { ALL_PHASES, V1_PHASES } from "../../src/types/methodology";
import { submitCommand } from "../services/command-handlers";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ProductToolMode = "analysis" | "chat";

export const ANALYSIS_MODE_TOOL_DEFINITIONS = [
  {
    name: "get_entity",
    description: "Get a single analysis entity by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity ID to fetch" },
      },
      required: ["id"],
    },
  },
  {
    name: "query_entities",
    description:
      "Query analysis entities by phase, type, or stale status for read-only analysis.",
    inputSchema: {
      type: "object" as const,
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
    description:
      "Query analysis relationships by type or entity involvement for read-only analysis.",
    inputSchema: {
      type: "object" as const,
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
    name: "request_loopback",
    description:
      "Record a methodology disruption trigger for orchestrator loopback handling.",
    inputSchema: {
      type: "object" as const,
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
  {
    name: "ask_user",
    description:
      "Ask the user one or more clarifying questions. Use when you need human input about assumptions, actor motivations, scenario boundaries, or analytical choices. The tool blocks until the user answers all questions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              header: {
                type: "string",
                description:
                  "Short label for the question (e.g. 'Clarification needed')",
              },
              question: {
                type: "string",
                description: "The question text to present to the user",
              },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Option label" },
                    description: {
                      type: "string",
                      description: "Optional description of the option",
                    },
                  },
                  required: ["label"],
                },
                description: "Optional predefined answer choices",
              },
              multiSelect: {
                type: "boolean",
                description: "Allow selecting multiple options (default false)",
              },
            },
            required: ["question"],
          },
          description: "One or more questions to ask the user",
        },
      },
      required: ["questions"],
    },
  },
] as const satisfies readonly ToolDefinition[];

export const CHAT_MODE_TOOL_DEFINITIONS = [
  ...ANALYSIS_MODE_TOOL_DEFINITIONS,
  {
    name: "start_analysis",
    description:
      "Start a new game-theoretic analysis of a real-world topic. Returns a run ID for tracking progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "The real-world topic to analyze",
        },
        provider: {
          type: "string",
          description:
            "AI provider to use for the analysis (e.g. anthropic, openai). Preserves provider affinity across phases.",
        },
        model: {
          type: "string",
          description:
            "Model ID to use for the analysis (e.g. claude-sonnet-4-20250514, gpt-4o). Preserves model affinity across phases.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_analysis_status",
    description: "Get the current status of the active analysis or rerun job.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_entity",
    description: "Create a new analysis entity with AI provenance.",
    inputSchema: {
      type: "object" as const,
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
        rationale: { type: "string", description: "Reasoning for this entity" },
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
      type: "object" as const,
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
    description: "Delete an analysis entity by ID.",
    inputSchema: {
      type: "object" as const,
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
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Relationship type: plays-in, has-objective, conflicts-with, has-strategy, supports, contradicts, produces, depends-on, invalidated-by, constrains, escalates-to, links, precedes, informed-by, derived-from",
        },
        fromEntityId: { type: "string", description: "Source entity ID" },
        toEntityId: { type: "string", description: "Target entity ID" },
        metadata: {
          type: "object",
          description: "Optional metadata for the relationship",
        },
      },
      required: ["type", "fromEntityId", "toEntityId"],
    },
  },
  {
    name: "delete_relationship",
    description: "Delete a relationship between two analysis entities by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Relationship ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "rerun_phases",
    description:
      "Trigger revalidation from the earliest specified methodology phase.",
    inputSchema: {
      type: "object" as const,
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
  {
    name: "abort_analysis",
    description: "Abort the currently running analysis job, if one exists.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const satisfies readonly ToolDefinition[];

export async function handleStartAnalysis(args: {
  topic: string;
  provider?: string;
  model?: string;
}): Promise<string> {
  const receipt = await submitCommand({
    kind: "analysis.start",
    topic: args.topic,
    provider: args.provider,
    model: args.model,
    requestedBy: "mcp:start_analysis",
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? "Failed to start analysis",
    });
  }

  return JSON.stringify(receipt.result);
}

function resolveToolRunId(): string | undefined {
  const envRunId = process.env.ANALYSIS_RUN_ID?.trim();
  if (envRunId) {
    return envRunId;
  }

  const activeAnalysis = analysisOrchestrator.getActiveStatus();
  if (activeAnalysis) {
    return activeAnalysis.runId;
  }

  const activeRevalidation = revalidationService.getActiveRevalStatus();
  return activeRevalidation?.runId;
}

function resolveToolContext(): AnalysisToolContext {
  const workspaceId = process.env.GTA_ANALYSIS_WORKSPACE_ID?.trim();
  const threadId = process.env.GTA_ANALYSIS_THREAD_ID?.trim();
  const phaseTurnId = process.env.GTA_ANALYSIS_PHASE_TURN_ID?.trim();
  const runId = resolveToolRunId();

  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(threadId ? { threadId } : {}),
    ...(runId ? { runId } : {}),
    ...(phaseTurnId ? { phaseTurnId } : {}),
  };
}

function resolveEarliestRerunPhase(
  phases: string[],
): MethodologyPhase | { error: string } {
  if (phases.length === 0) {
    return { error: "rerun_phases requires at least one phase" };
  }

  const invalidPhases = phases.filter(
    (phase) => !(ALL_PHASES as readonly string[]).includes(phase),
  );
  if (invalidPhases.length > 0) {
    return {
      error: `Unsupported phases: ${invalidPhases.join(", ")}`,
    };
  }

  const unsupportedPhases = phases.filter(
    (phase) => !(V1_PHASES as readonly string[]).includes(phase),
  );
  if (unsupportedPhases.length > 0) {
    return {
      error:
        `rerun_phases currently supports only implemented phases: ${V1_PHASES.join(", ")}. ` +
        `Unsupported: ${unsupportedPhases.join(", ")}`,
    };
  }

  return [...phases].sort(
    (left, right) =>
      V1_PHASES.indexOf(left as MethodologyPhase) -
      V1_PHASES.indexOf(right as MethodologyPhase),
  )[0] as MethodologyPhase;
}

export function handleGetAnalysisStatus(): string {
  const activeAnalysis = analysisOrchestrator.getActiveStatus();
  if (activeAnalysis) {
    return JSON.stringify(activeAnalysis);
  }

  const activeRevalidation = revalidationService.getActiveRevalStatus();
  if (activeRevalidation) {
    return JSON.stringify(activeRevalidation);
  }

  return JSON.stringify({ status: "idle" });
}

export function handleGetEntity(args: { id: string }): string {
  return JSON.stringify(getEntity(args.id, resolveToolContext()));
}

export function handleQueryEntities(args: {
  phase?: string;
  type?: string;
  stale?: boolean;
}): string {
  return JSON.stringify(
    queryEntities(
      {
        phase: args.phase,
        type: args.type,
        stale: args.stale,
      },
      resolveToolContext(),
    ),
  );
}

export function handleQueryRelationships(args: {
  type?: string;
  entityId?: string;
}): string {
  return JSON.stringify(
    queryRelationships(
      {
        type: args.type,
        entityId: args.entityId,
      },
      resolveToolContext(),
    ),
  );
}

export function handleRequestLoopback(args: {
  trigger_type: string;
  justification: string;
}): string {
  return JSON.stringify(requestLoopback(args, resolveToolContext()));
}

export async function handleCreateEntity(args: {
  type: string;
  phase: string;
  data: Record<string, unknown>;
  confidence?: string;
  rationale?: string;
  revision?: number;
}): Promise<string> {
  const runId = resolveToolRunId();
  const receipt = await submitCommand({
    kind: "entity.create",
    entity: {
      type: args.type as never,
      phase: args.phase as MethodologyPhase,
      data: args.data as never,
      confidence: (args.confidence as never) ?? "medium",
      rationale: args.rationale ?? "",
      revision: args.revision ?? 1,
      stale: false,
    },
    provenanceSource: "ai-edited",
    requestedBy: "mcp:create_entity",
    ...(runId ? { runId } : {}),
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? "Failed to create entity",
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleUpdateEntity(args: {
  id: string;
  updates: Record<string, unknown>;
}): Promise<string> {
  const runId = resolveToolRunId();
  const receipt = await submitCommand({
    kind: "entity.update",
    id: args.id,
    updates: args.updates as never,
    provenanceSource: "ai-edited",
    requestedBy: "mcp:update_entity",
    ...(runId ? { runId } : {}),
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? `Entity "${args.id}" not found`,
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleDeleteEntity(args: {
  id: string;
}): Promise<string> {
  const receipt = await submitCommand({
    kind: "entity.delete",
    id: args.id,
    requestedBy: "mcp:delete_entity",
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? `Entity "${args.id}" not found`,
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleCreateRelationship(args: {
  type: string;
  fromEntityId: string;
  toEntityId: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const runId = resolveToolRunId();
  const receipt = await submitCommand({
    kind: "relationship.create",
    relationship: {
      type: args.type as RelationshipType,
      fromEntityId: args.fromEntityId,
      toEntityId: args.toEntityId,
      metadata: args.metadata,
    },
    provenanceSource: "ai-edited",
    requestedBy: "mcp:create_relationship",
    ...(runId ? { runId } : {}),
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? "Failed to create relationship",
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleDeleteRelationship(args: {
  id: string;
}): Promise<string> {
  const receipt = await submitCommand({
    kind: "relationship.delete",
    id: args.id,
    requestedBy: "mcp:delete_relationship",
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? `Relationship "${args.id}" not found`,
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleRerunPhases(args: {
  phases: string[];
}): Promise<string> {
  const earliestPhase = resolveEarliestRerunPhase(args.phases);
  if (typeof earliestPhase !== "string") {
    return JSON.stringify(earliestPhase);
  }

  const receipt = await submitCommand({
    kind: "revalidation.start",
    startPhase: earliestPhase,
    requestedBy: "mcp:rerun_phases",
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? "Failed to start revalidation",
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleAbortAnalysis(): Promise<string> {
  const receipt = await submitCommand({
    kind: "analysis.abort",
    requestedBy: "mcp:abort_analysis",
  });

  if (receipt.status === "conflicted" || receipt.status === "failed") {
    return JSON.stringify({
      error: receipt.error?.message ?? "Failed to abort analysis",
    });
  }

  return JSON.stringify(receipt.result);
}

export async function handleAskUser(args: {
  questions: Array<{
    header?: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
}): Promise<string> {
  const context = resolveToolContext();
  if (!context.workspaceId || !context.threadId) {
    return JSON.stringify({
      error: "Cannot ask user without workspace/thread context",
    });
  }

  const results: Array<{
    questionId: string;
    question: string;
    answer: { selectedOptions?: number[]; customText?: string };
  }> = [];

  for (const q of args.questions) {
    const pending = questionService.getOrCreatePendingQuestion({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      runId: context.runId,
      phase: undefined,
      header: q.header ?? "Clarification needed",
      question: q.question,
      options: q.options,
      multiSelect: q.multiSelect,
      producer: "mcp:ask_user",
    });

    const answer = await questionService.waitForAnswer(pending.question.id);

    results.push({
      questionId: pending.question.id,
      question: q.question,
      answer: {
        selectedOptions: answer.selectedOptions,
        customText: answer.customText,
      },
    });
  }

  return JSON.stringify({ answers: results });
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ text: string; isError: boolean }> {
  const toolArgs = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "start_analysis":
        return {
          text: await handleStartAnalysis(toolArgs as never),
          isError: false,
        };
      case "get_analysis_status":
        return { text: handleGetAnalysisStatus(), isError: false };
      case "get_entity":
        return { text: handleGetEntity(toolArgs as never), isError: false };
      case "query_entities":
        return { text: handleQueryEntities(toolArgs as never), isError: false };
      case "query_relationships":
        return {
          text: handleQueryRelationships(toolArgs as never),
          isError: false,
        };
      case "request_loopback":
        return {
          text: handleRequestLoopback(toolArgs as never),
          isError: false,
        };
      case "create_entity":
        return {
          text: await handleCreateEntity(toolArgs as never),
          isError: false,
        };
      case "update_entity":
        return {
          text: await handleUpdateEntity(toolArgs as never),
          isError: false,
        };
      case "delete_entity":
        return {
          text: await handleDeleteEntity(toolArgs as never),
          isError: false,
        };
      case "create_relationship":
        return {
          text: await handleCreateRelationship(toolArgs as never),
          isError: false,
        };
      case "delete_relationship":
        return {
          text: await handleDeleteRelationship(toolArgs as never),
          isError: false,
        };
      case "rerun_phases":
        return {
          text: await handleRerunPhases(toolArgs as never),
          isError: false,
        };
      case "abort_analysis":
        return { text: await handleAbortAnalysis(), isError: false };
      case "ask_user":
        return {
          text: await handleAskUser(toolArgs as never),
          isError: false,
        };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

function getToolDefinitions(mode: ProductToolMode): readonly ToolDefinition[] {
  return mode === "analysis"
    ? ANALYSIS_MODE_TOOL_DEFINITIONS
    : CHAT_MODE_TOOL_DEFINITIONS;
}

export function registerProductTools(
  server: Server,
  mode: ProductToolMode = "chat",
): void {
  const toolDefinitions = getToolDefinitions(mode);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...toolDefinitions],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await handleToolCall(
      request.params.name,
      request.params.arguments as Record<string, unknown> | undefined,
    );

    return {
      content: [{ type: "text" as const, text: result.text }],
      ...(result.isError ? { isError: true } : {}),
    };
  });
}

export function registerAnalysisTools(server: Server): void {
  registerProductTools(server, "analysis");
}

export function registerChatTools(server: Server): void {
  registerProductTools(server, "chat");
}
