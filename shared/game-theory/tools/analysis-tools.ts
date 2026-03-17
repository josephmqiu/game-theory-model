import { z } from "zod";
import type {
  ToolDefinition,
  ToolContext,
  AnalysisStatus,
  PhaseProgress,
} from "../types/agent";
import { loadPhaseMethodology } from "../prompts/loader";

const PHASE_NAMES: Record<number, string> = {
  1: "Situational Grounding",
  2: "Player Identification",
  3: "Baseline Game Modelling",
  4: "Historical Game & Repeated Interaction",
  5: "Revalidation Loop",
  6: "Formal Representation",
  7: "Assumption & Sensitivity Extraction",
  8: "Outcome Elimination",
  9: "Scenario Generation",
  10: "Meta-Check",
};

type PhaseEntityMap = Record<
  number,
  Array<keyof import("../types/canonical").CanonicalStore>
>;

const PHASE_ENTITY_MAP: PhaseEntityMap = {
  1: ["sources", "observations", "claims", "inferences"],
  2: ["players"],
  3: ["games", "formalizations"],
  4: [
    "trust_assessments",
    "repeated_game_patterns",
    "dynamic_inconsistency_risks",
  ],
  5: ["revalidation_events"],
  6: ["formalizations", "signal_classifications"],
  7: ["assumptions", "contradictions", "latent_factors"],
  8: ["eliminated_outcomes"],
  9: ["scenarios", "tail_risks", "central_theses"],
  10: [],
};

function buildPhaseProgress(
  phase: number,
  canonical: ToolContext["canonical"],
): PhaseProgress {
  const entityKeys = PHASE_ENTITY_MAP[phase] ?? [];
  const entity_counts: Record<string, number> = {};

  for (const key of entityKeys) {
    const collection = canonical[key] as Record<string, unknown>;
    entity_counts[key] = Object.keys(collection).length;
  }

  const has_entities =
    entityKeys.length === 0
      ? false
      : Object.values(entity_counts).some((count) => count > 0);

  const coverage_warnings: string[] = [];

  if (phase === 2) {
    const playerCount = Object.keys(canonical.players).length;
    const sourceCount = Object.keys(canonical.sources).length;

    if (playerCount > 0 && sourceCount === 0) {
      coverage_warnings.push(
        "Players exist but no evidence has been gathered. The methodology says facts first.",
      );
    }

    if (playerCount === 1) {
      coverage_warnings.push(
        "Only 1 player identified. Most strategic situations involve at least 2 players.",
      );
    }
  }

  if (phase === 3) {
    const gameCount = Object.keys(canonical.games).length;
    const formalizationCount = Object.keys(canonical.formalizations).length;

    if (gameCount > 0 && formalizationCount === 0) {
      coverage_warnings.push("Games exist but none have formalizations.");
    }
  }

  return {
    phase,
    name: PHASE_NAMES[phase] ?? `Phase ${phase}`,
    has_entities,
    entity_counts,
    coverage_warnings,
  };
}

function findSolverReadyFormalizations(
  canonical: ToolContext["canonical"],
): string[] {
  const ready: string[] = [];

  for (const [id, formalization] of Object.entries(canonical.formalizations)) {
    if (formalization.kind !== "normal_form") continue;

    const normalForm =
      formalization as import("../types/formalizations").NormalFormModel;
    const cells = normalForm.payoff_cells;

    if (!Array.isArray(cells) || cells.length === 0) continue;

    const allCellsHavePayoffs = cells.every(
      (cell) =>
        cell.payoffs !== undefined && Object.keys(cell.payoffs).length > 0,
    );

    if (allCellsHavePayoffs) {
      ready.push(id);
    }
  }

  return ready;
}

export function createGetAnalysisStatusTool(): ToolDefinition {
  return {
    name: "get_analysis_status",
    description:
      "Returns the current analysis status, including entity counts per phase, coverage warnings, and solver-ready formalizations.",
    inputSchema: { type: "object", properties: {} },
    execute: async (_input: Record<string, unknown>, context: ToolContext) => {
      const analysisState = context.getAnalysisState();
      const { canonical } = context;

      const totalEntities = Object.values(canonical).reduce(
        (sum, collection) =>
          sum + Object.keys(collection as Record<string, unknown>).length,
        0,
      );

      const phases: PhaseProgress[] = Array.from({ length: 10 }, (_, i) =>
        buildPhaseProgress(i + 1, canonical),
      );

      const solver_ready_formalizations =
        findSolverReadyFormalizations(canonical);

      const warnings: string[] = phases.flatMap((p) => p.coverage_warnings);

      const status: AnalysisStatus = {
        has_analysis: analysisState !== null,
        description: analysisState?.event_description ?? null,
        phases,
        total_entities: totalEntities,
        solver_ready_formalizations,
        warnings,
      };

      return { success: true, data: status };
    },
  };
}

const phaseInputSchema = z.object({
  phase: z.number().int().min(1).max(10),
});

export function createGetMethodologyPhaseTool(): ToolDefinition {
  return {
    name: "get_methodology_phase",
    description:
      "Returns the methodology text for a given analysis phase (1–10).",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "number" },
      },
      required: ["phase"],
    },
    execute: async (input: Record<string, unknown>, _context: ToolContext) => {
      const parsed = phaseInputSchema.safeParse(input);

      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        };
      }

      const { phase } = parsed.data;
      const text = loadPhaseMethodology(phase);

      return { success: true, data: text };
    },
  };
}
