import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createEntity,
  updateEntity,
  getEntityById,
  createRelationship,
  getStaleEntityIds,
  removeEntity,
  removeRelationship,
} from "../services/entity-graph-service";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
} from "../services/analysis-tools";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type { RelationshipType } from "../../shared/types/entity";
import * as analysisOrchestrator from "../agents/analysis-agent";
import * as revalidationService from "../services/revalidation-service";
import {
  validateEntityUpdates,
  validateNewEntity,
} from "../services/entity-update-validation";
import { ALL_PHASES, RUNNABLE_PHASES } from "../../src/types/methodology";
import { getSearchProvider, type SearchProviderId } from "../services/search";
import {
  getSearchConfig,
  isSearchConfigured,
} from "../services/search/config-cache";
import { serverLog } from "../utils/ai-logger";

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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: "web_search",
    description:
      "Search the live web via the user's configured search provider. Returns a numbered list of results with title, URL, and snippet. Use this to ground claims in current, real-world information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The web search query",
        },
        max_results: {
          type: "number",
          description: "Maximum results to return (default 5, max 10)",
        },
      },
      required: ["query"],
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: "get_analysis_status",
    description: "Get the current status of the active analysis or rerun job.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
        fromId: { type: "string", description: "Source entity ID" },
        toId: { type: "string", description: "Target entity ID" },
        metadata: {
          type: "object",
          description: "Optional metadata for the relationship",
        },
      },
      required: ["type", "fromId", "toId"],
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: "abort_analysis",
    description: "Abort the currently running analysis job, if one exists.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
] as const satisfies readonly ToolDefinition[];

export async function handleStartAnalysis(args: {
  topic: string;
  provider?: string;
  model?: string;
}): Promise<string> {
  const { runId } = await analysisOrchestrator.runFull(
    args.topic,
    args.provider,
    args.model,
  );
  return JSON.stringify({
    runId,
    status: "started",
    estimatedPhases: RUNNABLE_PHASES.length,
  });
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
    (phase) => !(RUNNABLE_PHASES as readonly string[]).includes(phase),
  );
  if (unsupportedPhases.length > 0) {
    return {
      error:
        `rerun_phases supports only runnable phases: ${RUNNABLE_PHASES.join(", ")}. ` +
        `Unsupported: ${unsupportedPhases.join(", ")}`,
    };
  }

  return [...phases].sort(
    (left, right) =>
      RUNNABLE_PHASES.indexOf(left as MethodologyPhase) -
      RUNNABLE_PHASES.indexOf(right as MethodologyPhase),
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
  return JSON.stringify(getEntity(args.id));
}

export function handleQueryEntities(args: {
  phase?: string;
  type?: string;
  stale?: boolean;
}): string {
  return JSON.stringify(
    queryEntities({
      phase: args.phase,
      type: args.type,
      stale: args.stale,
    }),
  );
}

export function handleQueryRelationships(args: {
  type?: string;
  entityId?: string;
}): string {
  return JSON.stringify(
    queryRelationships({
      type: args.type,
      entityId: args.entityId,
    }),
  );
}

export function handleRequestLoopback(args: {
  trigger_type: string;
  justification: string;
}): string {
  return JSON.stringify(requestLoopback(args));
}

export function handleCreateEntity(args: {
  type: string;
  phase: string;
  data: Record<string, unknown>;
  confidence?: string;
  rationale?: string;
  revision?: number;
}): string {
  const runId = resolveToolRunId();
  const validation = validateNewEntity(args.type, args.data);
  if (!validation.ok) {
    return JSON.stringify({
      error: "Validation failed",
      fieldErrors: validation.fieldErrors,
    });
  }

  const entity = createEntity(
    {
      type: validation.type,
      phase: args.phase as MethodologyPhase,
      data: validation.data,
      confidence: (args.confidence as never) ?? "medium",
      rationale: args.rationale ?? "",
      revision: args.revision ?? 1,
      stale: false,
    },
    {
      source: "ai-edited",
      logSource: "chat",
      ...(runId ? { runId } : {}),
    },
  );
  return JSON.stringify({
    created: [entity],
    updated: [],
    staleMarked: [],
    grouped: [],
  });
}

export function handleUpdateEntity(args: {
  id: string;
  updates: Record<string, unknown>;
}): string {
  const runId = resolveToolRunId();
  const existing = getEntityById(args.id);
  if (!existing) {
    return JSON.stringify({ error: `Entity "${args.id}" not found` });
  }

  const validation = validateEntityUpdates(existing, args.updates);
  if (!validation.ok) {
    return JSON.stringify({
      error: "Validation failed",
      fieldErrors: validation.fieldErrors,
    });
  }

  const staleBefore = new Set(getStaleEntityIds());
  const result = updateEntity(args.id, validation.updates, {
    source: "ai-edited",
    logSource: "chat",
    ...(runId ? { runId } : {}),
  });

  const staleAfter = getStaleEntityIds();
  const newlyStale = staleAfter.filter((id) => !staleBefore.has(id));

  return JSON.stringify({
    created: [],
    updated: [result],
    staleMarked: newlyStale,
    grouped: [],
  });
}

export function handleDeleteEntity(args: { id: string }): string {
  const deleted = removeEntity(args.id);
  if (!deleted) {
    return JSON.stringify({ error: `Entity "${args.id}" not found` });
  }

  return JSON.stringify({ deleted: true, id: args.id });
}

export function handleCreateRelationship(args: {
  type: string;
  fromId: string;
  toId: string;
  metadata?: Record<string, unknown>;
}): string {
  try {
    const runId = resolveToolRunId();
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

export function handleDeleteRelationship(args: { id: string }): string {
  const deleted = removeRelationship(args.id);
  if (!deleted) {
    return JSON.stringify({ error: `Relationship "${args.id}" not found` });
  }

  return JSON.stringify({ deleted: true, id: args.id });
}

export function handleRerunPhases(args: { phases: string[] }): string {
  const earliestPhase = resolveEarliestRerunPhase(args.phases);
  if (typeof earliestPhase !== "string") {
    return JSON.stringify(earliestPhase);
  }

  const { runId } = revalidationService.revalidate(undefined, earliestPhase);
  const status = revalidationService.getRevalStatus(runId);
  return JSON.stringify({
    runId,
    status: status?.status ?? "running",
    startPhase: earliestPhase,
  });
}

export function handleAbortAnalysis(): string {
  const activeStatus = analysisOrchestrator.getActiveStatus();
  if (!activeStatus) {
    return JSON.stringify({ aborted: false, status: "idle" });
  }

  analysisOrchestrator.abort();
  return JSON.stringify({ aborted: true, runId: activeStatus.runId });
}

const WEB_SEARCH_DEFAULT_MAX_RESULTS = 5;
const WEB_SEARCH_MAX_RESULTS = 10;

function clampMaxResults(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return WEB_SEARCH_DEFAULT_MAX_RESULTS;
  }
  return Math.min(WEB_SEARCH_MAX_RESULTS, Math.max(1, Math.floor(value)));
}

export async function handleWebSearch(args: {
  query: string;
  max_results?: number;
}): Promise<{ text: string; isError: boolean }> {
  if (!isSearchConfigured()) {
    return {
      text: "Web search is not configured. The user must add a search provider API key in Settings.",
      isError: true,
    };
  }

  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (query.length === 0) {
    return { text: "Web search requires a non-empty query.", isError: true };
  }

  const runId = resolveToolRunId();
  const { provider, apiKey } = getSearchConfig();
  const maxResults = clampMaxResults(args.max_results);

  serverLog(runId, "web-search", "start", {
    provider: provider ?? "none",
    maxResults,
    queryLength: query.length,
  });

  try {
    const searchProvider = getSearchProvider(provider as SearchProviderId);
    const results = await searchProvider.search(query, {
      apiKey: apiKey as string,
      maxResults,
    });

    serverLog(runId, "web-search", "result", {
      provider: provider ?? "none",
      resultCount: results.length,
    });

    if (results.length === 0) {
      return { text: `No web results found for "${query}".`, isError: false };
    }

    const formatted = results
      .map(
        (result, index) =>
          `${index + 1}. ${result.title || "(untitled)"}\n   ${result.url}\n   ${result.snippet}`,
      )
      .join("\n\n");
    return { text: formatted, isError: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    serverLog(runId, "web-search", "error", {
      provider: provider ?? "none",
      error: reason,
    });
    return { text: `Web search failed: ${reason}`, isError: true };
  }
}

type ProductToolResult = string | { text: string; isError: boolean };

type ProductToolHandler = (
  args: Record<string, unknown>,
) => ProductToolResult | Promise<ProductToolResult>;

export const PRODUCT_TOOL_HANDLERS = {
  start_analysis: (args) => handleStartAnalysis(args as never),
  get_analysis_status: () => handleGetAnalysisStatus(),
  get_entity: (args) => handleGetEntity(args as never),
  query_entities: (args) => handleQueryEntities(args as never),
  query_relationships: (args) => handleQueryRelationships(args as never),
  request_loopback: (args) => handleRequestLoopback(args as never),
  create_entity: (args) => handleCreateEntity(args as never),
  update_entity: (args) => handleUpdateEntity(args as never),
  delete_entity: (args) => handleDeleteEntity(args as never),
  create_relationship: (args) => handleCreateRelationship(args as never),
  delete_relationship: (args) => handleDeleteRelationship(args as never),
  rerun_phases: (args) => handleRerunPhases(args as never),
  abort_analysis: () => handleAbortAnalysis(),
  web_search: (args) => handleWebSearch(args as never),
} satisfies Record<string, ProductToolHandler>;

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ text: string; isError: boolean }> {
  const toolArgs = (args ?? {}) as Record<string, unknown>;

  try {
    const handler =
      PRODUCT_TOOL_HANDLERS[name as keyof typeof PRODUCT_TOOL_HANDLERS];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const raw = await handler(toolArgs);
    if (typeof raw === "string") {
      return { text: raw, isError: false };
    }
    return { text: raw.text, isError: raw.isError };
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
