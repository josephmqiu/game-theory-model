// synthesis-service.ts — Post-analysis AI synthesis.
// Reads the full entity graph, produces a compact summary, calls the AI
// to generate an analysis-report entity, and creates relationship edges.
//
// The AI call is injectable (aiCaller option) so tests and Task 5 can
// wire the real adapter without changing this module.

import type {
  AnalysisEntity,
  EntityType,
  RelationshipType,
} from "../../shared/types/entity";
import { analysisReportDataSchema } from "../../src/types/entity";
import * as entityGraphService from "./entity-graph-service";
import { serverLog, serverError } from "../utils/ai-logger";
import { resolvePromptTemplate } from "./prompt-pack-registry";
import {
  DEFAULT_ANALYSIS_TYPE,
  SYNTHESIS_PROMPT_PACK_MODE,
} from "../../shared/types/prompt-pack";

// ── Types ──

/** Injectable AI caller — takes the serialized graph summary and returns raw report data. */
export type AiCaller = (graphSummary: string) => Promise<unknown>;

export interface SynthesizeOptions {
  /** Override the AI call. When omitted, the stub throws (wired in Task 5). */
  aiCaller?: AiCaller;
  runId?: string;
}

// ── System prompt ──

export function getSynthesisSystemPrompt(): string {
  const resolved = resolvePromptTemplate({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: SYNTHESIS_PROMPT_PACK_MODE,
    templateId: "system",
    variant: "initial",
  });
  return resolved.text;
}

// ── Graph serialization ──

/**
 * Serialize entities into a compact one-line-per-entity summary.
 * Format: [id] type (phase): name
 */
export function serializeGraphSummary(entities: AnalysisEntity[]): string {
  return entities
    .map((e) => {
      const name = extractEntityName(e);
      return `[${e.id}] ${e.type} (${e.phase}): ${name}`;
    })
    .join("\n");
}

function extractEntityName(entity: AnalysisEntity): string {
  const data = entity.data as Record<string, unknown>;
  if (typeof data.name === "string" && data.name.length > 0) return data.name;
  if (typeof data.content === "string" && data.content.length > 0)
    return data.content;
  return entity.id;
}

// ── Relationship type resolution ──

function resolveRelationshipType(entityType: EntityType): RelationshipType {
  switch (entityType) {
    case "scenario":
    case "equilibrium-result":
      return "derived-from";
    case "assumption":
      return "depends-on";
    default:
      return "informed-by";
  }
}

// ── Synthesis ──

/**
 * Run post-analysis synthesis: read the entity graph, call the AI,
 * create an analysis-report entity with relationship edges.
 *
 * Returns the created entity on success, null on empty graph or error.
 */
export async function synthesizeReport(
  options?: SynthesizeOptions,
): Promise<AnalysisEntity | null> {
  const runId = options?.runId;
  const aiCaller = options?.aiCaller;

  try {
    const analysis = entityGraphService.getAnalysis();

    if (analysis.entities.length === 0) {
      serverLog(runId, "synthesis", "skip-empty-graph");
      return null;
    }

    const graphSummary = serializeGraphSummary(analysis.entities);
    serverLog(runId, "synthesis", "graph-serialized", {
      entityCount: analysis.entities.length,
      summaryLength: graphSummary.length,
    });

    // Call the AI — stub throws until Task 5 wires a real adapter
    let rawResult: unknown;
    if (aiCaller) {
      rawResult = await aiCaller(graphSummary);
    } else {
      throw new Error("AI call not yet wired");
    }

    // Validate the AI output against the schema
    const reportData = analysisReportDataSchema.parse(rawResult);

    // Create the analysis-report entity
    const reportEntity = entityGraphService.createEntity(
      {
        type: "analysis-report",
        phase: "meta-check", // last runnable phase — report sits at the end
        data: reportData,
        confidence: "high",
        rationale: "Synthesized from full entity graph",
        revision: 1,
        stale: false,
      },
      {
        source: "phase-derived",
        runId,
        phase: "synthesis",
      },
    );

    serverLog(runId, "synthesis", "report-entity-created", {
      entityId: reportEntity.id,
    });

    // Create relationships for each entity_reference
    const entityMap = new Map(analysis.entities.map((e) => [e.id, e]));

    for (const ref of reportData.entity_references) {
      const referencedEntity = entityMap.get(ref.entity_id);
      if (!referencedEntity) {
        serverLog(runId, "synthesis", "skip-missing-reference", {
          entityId: ref.entity_id,
          displayName: ref.display_name,
        });
        continue;
      }

      const relationshipType = resolveRelationshipType(referencedEntity.type);

      entityGraphService.createRelationship(
        {
          type: relationshipType,
          fromEntityId: reportEntity.id,
          toEntityId: ref.entity_id,
        },
        {
          source: "phase-derived",
          runId,
          phase: "synthesis",
        },
      );
    }

    serverLog(runId, "synthesis", "synthesis-complete", {
      entityId: reportEntity.id,
      relationshipsCreated: reportData.entity_references.length,
    });

    return reportEntity;
  } catch (err) {
    serverError(runId, "synthesis", "synthesis-failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
