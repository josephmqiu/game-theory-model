import type { MethodologyPhase } from "../../shared/types/methodology";
import {
  DEFAULT_ANALYSIS_TYPE,
  DEFAULT_PROMPT_PACK_MODE,
  type PromptPackPhaseConfig,
} from "../../shared/types/prompt-pack";
import { getCanonicalAnalysisPhaseIndex } from "./analysis-phase-selection";
import * as entityGraphService from "./entity-graph-service";
import { resolvePromptPack } from "./prompt-pack-registry";

const MAX_ANCHOR_ENTITIES = 8;

function describeEntity(
  entity: ReturnType<typeof entityGraphService.getAnalysis>["entities"][number],
): string {
  if ("name" in entity.data && typeof entity.data.name === "string") {
    return entity.data.name;
  }
  if ("description" in entity.data && typeof entity.data.description === "string") {
    return entity.data.description;
  }
  if ("content" in entity.data && typeof entity.data.content === "string") {
    return entity.data.content;
  }
  return entity.id;
}

function resolvePhaseConfig(phase: MethodologyPhase): PromptPackPhaseConfig {
  const pack = resolvePromptPack({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: DEFAULT_PROMPT_PACK_MODE,
  });
  const config = pack.phases?.find((candidate) => candidate.phase === phase);
  if (!config) {
    throw new Error(`Prompt pack is missing phase config for "${phase}".`);
  }
  return config;
}

export interface PhaseBriefInput {
  phase: MethodologyPhase;
  topic: string;
  completedPhases: MethodologyPhase[];
  activePhases: MethodologyPhase[];
  revisionRetryInstruction?: string;
}

export interface PhaseBrief {
  phaseBrief: string;
  phaseConfig: PromptPackPhaseConfig;
}

export function buildPhaseBrief(input: PhaseBriefInput): PhaseBrief {
  const phaseConfig = resolvePhaseConfig(input.phase);
  const currentPhaseIndex = getCanonicalAnalysisPhaseIndex(input.phase);
  const priorCompletedPhases = input.completedPhases.filter((phase) => {
    if (!input.activePhases.includes(phase)) {
      return false;
    }

    const phaseIndex = getCanonicalAnalysisPhaseIndex(phase);
    return phaseIndex !== -1 && phaseIndex < currentPhaseIndex;
  });

  const analysis = entityGraphService.getAnalysis();
  const priorEntities = analysis.entities.filter((entity) =>
    priorCompletedPhases.includes(entity.phase),
  );

  const digestLines =
    priorCompletedPhases.length === 0
      ? ["- No earlier active phases have completed in this run yet."]
      : priorCompletedPhases.map((phase) => {
          const phaseEntities = priorEntities.filter(
            (entity) => entity.phase === phase,
          );
          if (phaseEntities.length === 0) {
            return `- ${phase}: no entities currently recorded.`;
          }

          const countsByType = new Map<string, number>();
          for (const entity of phaseEntities) {
            countsByType.set(entity.type, (countsByType.get(entity.type) ?? 0) + 1);
          }

          const countsSummary = [...countsByType.entries()]
            .map(([type, count]) => `${count} ${type}`)
            .join(", ");

          return `- ${phase}: ${countsSummary}`;
        });

  const anchorLines =
    priorEntities.length === 0
      ? ["- No anchor entities yet. Use tools as the graph grows."]
      : priorEntities.slice(0, MAX_ANCHOR_ENTITIES).map((entity) => {
          const summary = describeEntity(entity).replace(/\s+/g, " ").trim();
          return `- ${entity.id} (${entity.phase}/${entity.type}): ${summary}`;
        });

  const lines = [
    `Topic: ${input.topic}`,
    `Phase objective: ${phaseConfig.objective}`,
    `Done condition: ${phaseConfig.doneCondition}`,
    "",
    "Prior-phase digest:",
    ...digestLines,
    "",
    "Anchor entities:",
    ...anchorLines,
    "",
    "Context access guidance:",
    "- Use get_entity for a specific node when you need exact fields or provenance.",
    "- Use query_entities and query_relationships for the full graph context instead of assuming the brief is exhaustive.",
  ];

  if (input.revisionRetryInstruction) {
    lines.push(
      "",
      "Revision instruction:",
      input.revisionRetryInstruction,
    );
  }

  return {
    phaseBrief: lines.join("\n"),
    phaseConfig,
  };
}
