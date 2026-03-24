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

// ── Types ──

/** Injectable AI caller — takes the serialized graph summary and returns raw report data. */
export type AiCaller = (graphSummary: string) => Promise<unknown>;

export interface SynthesizeOptions {
  /** Override the AI call. When omitted, the stub throws (wired in Task 5). */
  aiCaller?: AiCaller;
  runId?: string;
}

// ── System prompt ──

export const SYNTHESIS_SYSTEM_PROMPT = `You are a game-theory analyst synthesizing a completed multi-phase analysis into a single executive report.

You will receive a compact summary of the entity graph produced by the analysis phases. Each line represents one entity:
[id] type (phase): name

Your job is to produce a structured analysis-report object with the following fields:
- executive_summary: A concise 2-4 sentence summary of the overall analysis finding.
- why: The core analytical reasoning — why the conclusion follows from the evidence.
- key_evidence: An array of the most important evidence points (strings) that support the conclusion.
- open_assumptions: An array of assumptions that the conclusion depends on and that could change the outcome if invalidated.
- entity_references: An array of {entity_id, display_name} objects referencing the most important entities from the graph. Use exact entity IDs from the summary.
- prediction_verdict: null (unless a specific prediction question was analyzed).
- what_would_change: An array of concrete events or developments that would invalidate or significantly alter this analysis.
- source_url: null
- analysis_timestamp: Current ISO 8601 timestamp.

Focus on analytical clarity. Reference specific entities by their IDs. Prioritize the most decision-relevant findings.`;

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
