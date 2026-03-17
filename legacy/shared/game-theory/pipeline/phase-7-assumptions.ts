import type {
  AssumptionExtractionResult,
  ModelProposal,
  PhaseResult,
} from "../types/analysis-pipeline";
import {
  buildOwnerIndexes,
  collectCanonicalCandidates,
  collectFormalizationCandidates,
  collectHistoricalCandidates,
  getFormalizationResult,
  getHistoricalResult,
  mergeCandidates,
} from "./phase-7-assumption-candidates";
import type { Phase7RunnerContext } from "./phase-7-assumption-candidates";
import {
  buildClusters,
  buildFinalizedAssumptions,
  buildProposal,
  buildSensitivitySummary,
} from "./phase-7-assumption-analysis";

export type { Phase7RunnerContext };

export function runPhase7Assumptions(
  context: Phase7RunnerContext,
): AssumptionExtractionResult {
  const historical = getHistoricalResult(context.phaseResults);
  const phase6 = getFormalizationResult(context.phaseResults);
  const ownerIndexes = buildOwnerIndexes(context.canonical);

  const mergedCandidates = mergeCandidates(
    [
      ...collectCanonicalCandidates(context.canonical, ownerIndexes),
      ...collectHistoricalCandidates(context.canonical, historical),
      ...collectFormalizationCandidates(context.canonical, phase6),
    ],
    context.canonical,
  );

  const finalized = buildFinalizedAssumptions(
    mergedCandidates,
    context.canonical,
    phase6,
    context.getDerivedState,
  );
  const clustered = buildClusters(finalized, context.canonical);
  const proposals = clustered.assumptions
    .map((assumption) => buildProposal(context, assumption))
    .filter((proposal): proposal is ModelProposal => proposal !== null);

  const gaps: string[] = [];
  if (clustered.assumptions.length === 0) {
    gaps.push("No assumptions were extracted from the accepted model state.");
  }
  if (
    clustered.assumptions.some(
      (assumption) =>
        assumption.sensitivity === "critical" &&
        assumption.evidence_quality !== "direct_evidence",
    )
  ) {
    gaps.push(
      "One or more critical assumptions rely on inference rather than direct evidence.",
    );
  }

  const status: PhaseResult = {
    status: "complete",
    phase: 7,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps,
  };

  return {
    phase: 7,
    status,
    assumptions: clustered.assumptions.map((assumption) => ({
      temp_id: assumption.temp_id,
      statement: assumption.statement,
      type: assumption.type,
      sensitivity: assumption.sensitivity,
      what_if_wrong: assumption.what_if_wrong,
      game_theoretic_vs_empirical: assumption.game_theoretic_vs_empirical,
      correlated_cluster_id: assumption.correlated_cluster_id,
      evidence_quality: assumption.evidence_quality,
      evidence_refs: assumption.evidence_refs,
      affected_conclusions: assumption.affected_conclusions,
      confidence: assumption.confidence,
    })),
    correlated_clusters: clustered.clusters,
    sensitivity_summary: buildSensitivitySummary(
      clustered.assumptions,
      clustered.clusters,
    ),
    proposals,
  };
}
