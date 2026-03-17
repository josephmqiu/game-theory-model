import { z } from "zod";
import type {
  ToolDefinition,
  ToolContext,
  AnalysisStatus,
  PhaseProgress,
} from "../types/agent";
import { loadPhaseMethodology } from "../prompts/loader";
import { buildPhaseProgress } from "./phase-mapping";

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
        buildPhaseProgress(
          i + 1,
          canonical as unknown as Record<string, Record<string, unknown>>,
        ),
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
