import { dispatch } from "../engine/dispatch";
import { createEventLog } from "../engine/events";
import type {
  FormalizationResult,
  Phase6RunInput,
  PhaseResult,
} from "../types/analysis-pipeline";
import { PHASE6_ALL_SUBSECTIONS } from "./phase-6-subsections";
import type {
  Phase6OverlayResult,
  Phase6RunnerContext,
  Phase6WorkingState,
} from "./phase-6-shared";
import {
  createProposalGroupRecord,
  emptyStatus,
  queueStatus,
  replaceStatus,
} from "./phase-6-shared";
import {
  planFormalRepresentations,
  planPayoffEstimation,
  seedAcceptedFormalizations,
} from "./phase-6-planning";
import {
  analyzeFormalizations,
  buildBargainingDynamics,
  buildBehavioralOverlay,
  buildCommunicationAnalysis,
  buildCrossGameEffects,
  buildOptionValue,
  buildProposalGroups,
  buildWorkspacePreviews,
  dedupeEntityRefs,
} from "./phase-6-analysis";

function buildOverlayStore(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): Phase6OverlayResult {
  const commands = Object.values(state.proposalsBySubsection).flatMap(
    (proposals) => proposals.flatMap((proposal) => proposal.commands),
  );

  if (commands.length === 0) {
    return {
      status: "ready",
      store: context.canonical,
      warnings: [],
    };
  }

  const result = dispatch(
    context.canonical,
    createEventLog(context.analysisState.id, context.baseRevision),
    {
      kind: "batch",
      label: "Phase 6 proposed overlay",
      commands,
      base_revision: context.baseRevision,
    },
    { dryRun: true, source: "ai_merge" },
  );

  if (result.status === "dry_run") {
    return {
      status: "ready",
      store: result.store,
      warnings: [],
    };
  }

  if (result.status !== "rejected") {
    return {
      status: "failed",
      store: null,
      warnings: [
        "Could not build the speculative Phase 6 overlay due to an unexpected dispatch result.",
      ],
    };
  }

  return {
    status: "failed",
    store: null,
    warnings: [
      `Could not build the speculative Phase 6 overlay: ${result.errors.join(" ")}`,
    ],
  };
}

export function runPhase6Formalization(
  input: Phase6RunInput | undefined,
  context: Phase6RunnerContext,
): FormalizationResult {
  const subsections = input?.subsections?.length
    ? PHASE6_ALL_SUBSECTIONS.filter((subsection) =>
        input.subsections?.includes(subsection),
      )
    : PHASE6_ALL_SUBSECTIONS;
  const state: Phase6WorkingState = {
    subsections,
    plannedFormalizations: [],
    proposalsBySubsection: createProposalGroupRecord(),
    subsectionStatuses: [],
    revalidationTriggers: [],
    revalidationEntities: [],
    revalidationNotes: [],
  };

  if (!subsections.includes("6a")) {
    seedAcceptedFormalizations(context, state);
  }

  let formal_representations = subsections.includes("6a")
    ? planFormalRepresentations(context, state)
    : {
        status: "not_applicable" as const,
        summaries: [],
        reused_formalization_ids: [],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      };

  let payoff_estimation = subsections.includes("6b")
    ? planPayoffEstimation(context, state)
    : {
        status: "not_applicable" as const,
        updates: [],
        warnings: [],
      };

  const overlayStore = buildOverlayStore(context, state);
  if (overlayStore.status === "failed") {
    if (subsections.includes("6a")) {
      formal_representations = {
        ...formal_representations,
        status: "partial",
        warnings: [
          ...formal_representations.warnings,
          ...overlayStore.warnings,
        ],
      };
      replaceStatus(
        state,
        "6a",
        emptyStatus(
          "6a",
          "partial",
          "Prepared formal representations, but the speculative overlay could not be built.",
          overlayStore.warnings,
        ),
      );
    }
    if (subsections.includes("6b")) {
      payoff_estimation = {
        ...payoff_estimation,
        status: "partial",
        warnings: [...payoff_estimation.warnings, ...overlayStore.warnings],
      };
      replaceStatus(
        state,
        "6b",
        emptyStatus(
          "6b",
          "partial",
          "Generated payoff updates, but the speculative overlay could not be built.",
          overlayStore.warnings,
        ),
      );
    }
  }
  const { baseline_equilibria, equilibrium_selection } =
    subsections.includes("6c") || subsections.includes("6d")
      ? analyzeFormalizations(overlayStore, state)
      : {
          baseline_equilibria: {
            status: "not_applicable" as const,
            analyses: [],
            warnings: [],
          },
          equilibrium_selection: {
            status: "not_applicable" as const,
            selections: [],
            warnings: [],
          },
        };

  if (subsections.includes("6c")) {
    queueStatus(
      state,
      emptyStatus(
        "6c",
        baseline_equilibria.analyses.length > 0
          ? baseline_equilibria.status
          : "partial",
        baseline_equilibria.analyses.length > 0
          ? `Generated baseline equilibrium summaries for ${baseline_equilibria.analyses.length} formalization(s).`
          : "No formalization was solver-ready enough for equilibrium summarization.",
        baseline_equilibria.warnings,
      ),
    );
  }

  if (subsections.includes("6d")) {
    queueStatus(
      state,
      emptyStatus(
        "6d",
        equilibrium_selection.selections.length > 0
          ? equilibrium_selection.status
          : "partial",
        equilibrium_selection.selections.length > 0
          ? "Documented equilibrium-selection rationale for the live solver candidates."
          : "No multiple-equilibrium case required a separate selection rationale.",
        equilibrium_selection.warnings,
      ),
    );
  }

  const bargaining_dynamics = subsections.includes("6e")
    ? buildBargainingDynamics(overlayStore, state)
    : null;
  const communication_analysis = subsections.includes("6f")
    ? buildCommunicationAnalysis(context, state)
    : {
        status: "not_applicable" as const,
        classifications: [],
        warnings: [],
      };
  const option_value = subsections.includes("6g")
    ? buildOptionValue(context, state)
    : null;
  const behavioral_overlays = subsections.includes("6h")
    ? buildBehavioralOverlay(context, state)
    : null;
  const cross_game_effects = subsections.includes("6i")
    ? buildCrossGameEffects(context, state)
    : null;

  const proposal_groups = buildProposalGroups(state);
  const proposals = proposal_groups.flatMap((group) => group.proposals);
  const workspace_previews = buildWorkspacePreviews(overlayStore, state);
  const partialSubsections = state.subsectionStatuses.filter(
    (entry) => entry.status !== "complete",
  );
  const phaseStatus: PhaseResult = {
    status: partialSubsections.length > 0 ? "partial" : "complete",
    phase: 6,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps: partialSubsections.map(
      (entry) => `${entry.subsection}: ${entry.summary}`,
    ),
  };

  return {
    phase: 6,
    status: phaseStatus,
    subsections_run: subsections,
    subsection_statuses: state.subsectionStatuses,
    formal_representations,
    payoff_estimation,
    baseline_equilibria,
    equilibrium_selection,
    bargaining_dynamics,
    communication_analysis,
    option_value,
    behavioral_overlays,
    cross_game_effects,
    proposals,
    proposal_groups,
    workspace_previews,
    revalidation_signals: {
      triggers_found: [...new Set(state.revalidationTriggers)],
      affected_entities: dedupeEntityRefs(state.revalidationEntities),
      description:
        state.revalidationNotes.join(" ") ||
        "Phase 6 introduced no additional revalidation signals.",
    },
  };
}
