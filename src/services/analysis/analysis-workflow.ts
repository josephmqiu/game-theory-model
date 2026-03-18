import type { AnalysisInsights } from "@/services/analysis/analysis-insights";
import type { AnalysisSummary } from "@/services/analysis/analysis-summary";
import { DEFAULT_ANALYSIS_NAME } from "@/services/analysis/analysis-normalization";
import type {
  Analysis,
  AnalysisValidation,
  AnalysisWorkflowState,
  GuidedWorkflowStage,
} from "@/types/analysis";

export const GUIDED_WORKFLOW_STAGES: GuidedWorkflowStage[] = [
  "details",
  "strategies",
  "payoffs",
  "review",
  "insights",
];

export const GUIDED_WORKFLOW_STAGE_LABELS: Record<GuidedWorkflowStage, string> =
  {
    details: "Details",
    strategies: "Strategies",
    payoffs: "Payoffs",
    review: "Review",
    insights: "Insights",
  };

export const GUIDED_WORKFLOW_SECTION_IDS: Record<GuidedWorkflowStage, string> =
  {
    details: "analysis-details",
    strategies: "analysis-strategies",
    payoffs: "analysis-payoffs",
    review: "analysis-review",
    insights: "analysis-insights",
  };

export type AnalysisWorkflowStatus =
  | "complete"
  | "available"
  | "needs-attention"
  | "blocked";

export interface AnalysisWorkflowStageSummary {
  stage: GuidedWorkflowStage;
  label: string;
  sectionId: string;
  status: AnalysisWorkflowStatus;
  blocker: string | null;
  previousStage: GuidedWorkflowStage | null;
  nextStage: GuidedWorkflowStage | null;
  isCurrent: boolean;
}

export interface AnalysisWorkflow {
  currentStage: GuidedWorkflowStage;
  recommendedNextStage: GuidedWorkflowStage;
  returnToStage: GuidedWorkflowStage | null;
  stages: AnalysisWorkflowStageSummary[];
  current: AnalysisWorkflowStageSummary;
}

export function isGuidedWorkflowStage(
  value: unknown,
): value is GuidedWorkflowStage {
  return (
    typeof value === "string" &&
    (GUIDED_WORKFLOW_STAGES as string[]).includes(value)
  );
}

export function createDefaultAnalysisWorkflowState(): AnalysisWorkflowState {
  return {
    currentStage: "details",
  };
}

function hasIssuePath(
  validation: AnalysisValidation,
  path: string,
): boolean {
  return validation.issues.some((issue) => issue.path === path);
}

function hasIssuePrefix(
  validation: AnalysisValidation,
  prefix: string,
): boolean {
  return validation.issues.some(
    (issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`),
  );
}

export function getAnalysisWorkflowAttentionState(
  analysis: Analysis,
  validation: AnalysisValidation,
  summary: AnalysisSummary,
): {
  detailsNeedsAttention: boolean;
  strategiesReady: boolean;
  payoffsComplete: boolean;
  reviewReady: boolean;
} {
  const detailsNeedsAttention =
    analysis.name.trim().length === 0 ||
    analysis.name.trim() === DEFAULT_ANALYSIS_NAME;
  const strategiesReady =
    !hasIssuePrefix(validation, "players") && !hasIssuePath(validation, "name");
  const payoffsComplete =
    summary.incompleteProfileCount === 0 && summary.missingProfileCount === 0;
  const reviewReady = validation.isValid && payoffsComplete;

  return {
    detailsNeedsAttention,
    strategiesReady,
    payoffsComplete,
    reviewReady,
  };
}

export function deriveWorkflowStageFromAnalysis(
  _analysis: Analysis,
  validation: AnalysisValidation,
): GuidedWorkflowStage {
  if (hasIssuePath(validation, "name")) {
    return "details";
  }

  if (hasIssuePrefix(validation, "players")) {
    return "strategies";
  }

  if (!validation.isComplete) {
    return "payoffs";
  }

  return "review";
}

export function normalizeAnalysisWorkflowState(
  analysis: Analysis,
  validation: AnalysisValidation,
  workflow?: Partial<AnalysisWorkflowState> | null,
): AnalysisWorkflowState {
  if (isGuidedWorkflowStage(workflow?.currentStage)) {
    return {
      currentStage: workflow.currentStage,
    };
  }

  return {
    currentStage: deriveWorkflowStageFromAnalysis(analysis, validation),
  };
}

export function createAnalysisWorkflow(
  analysis: Analysis,
  validation: AnalysisValidation,
  summary: AnalysisSummary,
  insights: AnalysisInsights,
  currentStage: GuidedWorkflowStage,
): AnalysisWorkflow {
  const {
    detailsNeedsAttention,
    strategiesReady,
    payoffsComplete,
    reviewReady,
  } = getAnalysisWorkflowAttentionState(analysis, validation, summary);

  const recommendedNextStage = detailsNeedsAttention
    ? "details"
    : !strategiesReady
      ? "strategies"
      : !payoffsComplete
        ? "payoffs"
        : currentStage === "review"
          ? "insights"
          : currentStage === "insights"
            ? "insights"
            : "review";

  const returnToStage = reviewReady
    ? null
    : !strategiesReady
      ? "strategies"
      : !payoffsComplete
        ? "payoffs"
        : detailsNeedsAttention
          ? "details"
          : null;

  const reviewBlocker = !strategiesReady
    ? "Finish player and strategy setup before review."
    : !payoffsComplete
      ? "Complete every payoff cell before review."
      : null;
  const insightsBlocker =
    insights.status === "blocked"
      ? insights.blockMessage
      : reviewBlocker;

  const stageStatus: Record<GuidedWorkflowStage, AnalysisWorkflowStatus> = {
    details: detailsNeedsAttention ? "needs-attention" : "complete",
    strategies: strategiesReady ? "complete" : "needs-attention",
    payoffs: !strategiesReady
      ? "blocked"
      : payoffsComplete
        ? "complete"
        : "needs-attention",
    review: !reviewReady
      ? "blocked"
      : currentStage === "insights"
        ? "complete"
        : "available",
    insights: reviewReady ? "available" : "blocked",
  };

  const blockers: Record<GuidedWorkflowStage, string | null> = {
    details: detailsNeedsAttention
      ? "Rename the analysis so the workflow is grounded in a real case."
      : null,
    strategies: strategiesReady
      ? null
      : "Fix player and strategy setup before moving deeper into the workflow.",
    payoffs: !strategiesReady
      ? "Finish player and strategy setup before entering payoffs."
      : payoffsComplete
        ? null
        : "Complete the remaining payoff cells before review.",
    review: reviewBlocker,
    insights: insightsBlocker,
  };

  const stages = GUIDED_WORKFLOW_STAGES.map((stage, index) => ({
    stage,
    label: GUIDED_WORKFLOW_STAGE_LABELS[stage],
    sectionId: GUIDED_WORKFLOW_SECTION_IDS[stage],
    status: stageStatus[stage],
    blocker: blockers[stage],
    previousStage: index > 0 ? GUIDED_WORKFLOW_STAGES[index - 1] : null,
    nextStage:
      index < GUIDED_WORKFLOW_STAGES.length - 1
        ? GUIDED_WORKFLOW_STAGES[index + 1]
        : null,
    isCurrent: stage === currentStage,
  }));

  const current =
    stages.find((stage) => stage.stage === currentStage) ?? stages[0];

  return {
    currentStage,
    recommendedNextStage,
    returnToStage,
    stages,
    current,
  };
}
