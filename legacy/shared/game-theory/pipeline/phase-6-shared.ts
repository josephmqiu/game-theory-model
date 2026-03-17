import type { Command } from "../engine/commands";
import type { CanonicalStore } from "../types";
import type {
  AnalysisState,
  FormalizationRepresentationSummary,
  HistoricalGameResult,
  ModelProposal,
  Phase6Subsection,
  Phase6SubsectionStatus,
  PhaseExecution,
} from "../types/analysis-pipeline";
import type { EntityRef } from "../types/canonical";
import type { EstimateValue } from "../types/estimates";
import type {
  BargainingFormalization,
  BayesianGameModel,
  ExtensiveFormModel,
  Formalization,
  NormalFormModel,
  RepeatedGameModel,
  SignalingFormalization,
} from "../types/formalizations";
import { buildModelProposal, createEntityPreview } from "./helpers";

export interface Phase6RunnerContext {
  canonical: CanonicalStore;
  analysisState: AnalysisState;
  baseRevision: number;
  phaseExecution: PhaseExecution;
  phaseResults?: Record<number, unknown>;
}

export interface PlannedFormalization {
  id: string;
  gameId: string;
  gameName: string;
  kind: FormalizationRepresentationSummary["kind"];
  purpose: FormalizationRepresentationSummary["purpose"];
  abstraction_level: FormalizationRepresentationSummary["abstraction_level"];
  reused_existing: boolean;
  rationale: string;
  assumption_ids: string[];
  node_ids?: {
    root: string;
    accept: string;
    resist: string;
  };
}

export interface Phase6OverlayResult {
  status: "ready" | "failed";
  store: CanonicalStore | null;
  warnings: string[];
}

export type Phase6FormalizationPayload =
  | Omit<NormalFormModel, "id">
  | Omit<ExtensiveFormModel, "id">
  | Omit<RepeatedGameModel, "id">
  | Omit<BayesianGameModel, "id">
  | Omit<SignalingFormalization, "id">
  | Omit<BargainingFormalization, "id">;

export interface Phase6WorkingState {
  subsections: Phase6Subsection[];
  plannedFormalizations: PlannedFormalization[];
  proposalsBySubsection: Record<Phase6Subsection, ModelProposal[]>;
  subsectionStatuses: Phase6SubsectionStatus[];
  revalidationTriggers: FormalizationResult["revalidation_signals"]["triggers_found"];
  revalidationEntities: EntityRef[];
  revalidationNotes: string[];
}

// Re-import FormalizationResult for the type reference above
import type { FormalizationResult } from "../types/analysis-pipeline";

export const SUPPORTED_PHASE6_FORMALIZATION_KINDS = new Set<
  FormalizationRepresentationSummary["kind"]
>([
  "normal_form",
  "extensive_form",
  "repeated",
  "bayesian",
  "signaling",
  "bargaining",
]);

export function createStructuredEstimate(params: {
  representation: EstimateValue["representation"];
  value?: number;
  min?: number;
  max?: number;
  ordinal_rank?: number;
  rationale: string;
  confidence?: number;
  assumptions?: string[];
}): EstimateValue {
  return {
    representation: params.representation,
    value: params.value,
    min: params.min,
    max: params.max,
    ordinal_rank: params.ordinal_rank,
    confidence: params.confidence ?? 0.62,
    rationale: params.rationale,
    source_claims: [],
    assumptions: params.assumptions,
  };
}

export function emptyStatus(
  subsection: Phase6Subsection,
  status: Phase6SubsectionStatus["status"],
  summary: string,
  warnings: string[] = [],
): Phase6SubsectionStatus {
  return {
    subsection,
    status,
    summary,
    warnings,
  };
}

export function createProposalGroupRecord(): Record<
  Phase6Subsection,
  ModelProposal[]
> {
  return {
    "6a": [],
    "6b": [],
    "6c": [],
    "6d": [],
    "6e": [],
    "6f": [],
    "6g": [],
    "6h": [],
    "6i": [],
  };
}

export function firstGame(canonical: CanonicalStore) {
  return Object.values(canonical.games)[0] ?? null;
}

export function firstTwoPlayers(
  game: CanonicalStore["games"][string] | null,
): string[] {
  return game?.players.slice(0, 2) ?? [];
}

export function getHistoricalResult(
  context: Phase6RunnerContext,
): HistoricalGameResult | null {
  const phase4 = context.phaseResults?.[4];
  return phase4 &&
    typeof phase4 === "object" &&
    "phase" in phase4 &&
    phase4.phase === 4
    ? (phase4 as HistoricalGameResult)
    : null;
}

export function queueStatus(
  state: Phase6WorkingState,
  status: Phase6SubsectionStatus,
): void {
  state.subsectionStatuses = [...state.subsectionStatuses, status];
}

export function addProposal(
  state: Phase6WorkingState,
  subsection: Phase6Subsection,
  proposal: ModelProposal,
): void {
  state.proposalsBySubsection = {
    ...state.proposalsBySubsection,
    [subsection]: [
      ...state.proposalsBySubsection[subsection],
      {
        ...proposal,
        framing_id: subsection,
      },
    ],
  };
}

export function replaceStatus(
  state: Phase6WorkingState,
  subsection: Phase6Subsection,
  status: Phase6SubsectionStatus,
): void {
  state.subsectionStatuses = state.subsectionStatuses.map((entry) =>
    entry.subsection === subsection ? status : entry,
  );
}

export function buildAssumptionCommand(
  id: string,
  statement: string,
  type:
    | "behavioral"
    | "capability"
    | "structural"
    | "institutional"
    | "rationality"
    | "information",
): Command {
  return {
    kind: "add_assumption",
    id,
    payload: {
      statement,
      type,
      sensitivity: "medium",
      confidence: 0.62,
      game_theoretic_vs_empirical: "game_theoretic",
      correlated_cluster_id: null,
    },
  };
}

export function buildFormalizationSummary(
  formalization: Formalization,
  canonical: CanonicalStore,
  reusedExisting: boolean,
  rationale: string,
): FormalizationRepresentationSummary {
  return {
    formalization_id: formalization.id,
    game_id: formalization.game_id,
    game_name:
      canonical.games[formalization.game_id]?.name ?? formalization.game_id,
    kind: formalization.kind as FormalizationRepresentationSummary["kind"],
    purpose: formalization.purpose,
    abstraction_level: formalization.abstraction_level,
    reused_existing: reusedExisting,
    rationale,
    assumption_ids: [...formalization.assumptions],
  };
}

export function buildFormalizationProposal(
  context: Phase6RunnerContext,
  params: {
    subsection: Phase6Subsection;
    description: string;
    proposal_type: ModelProposal["proposal_type"];
    commands: Command[];
    previews: Array<ReturnType<typeof createEntityPreview>>;
  },
): ModelProposal {
  return buildModelProposal({
    description: params.description,
    phase: 6,
    proposal_type: params.proposal_type,
    phaseExecution: context.phaseExecution,
    baseRevision: context.baseRevision,
    commands: params.commands,
    entity_previews: params.previews,
  });
}

export function appendPlannedFormalization(
  state: Phase6WorkingState,
  planned: PlannedFormalization,
): void {
  state.plannedFormalizations = [...state.plannedFormalizations, planned];
}
