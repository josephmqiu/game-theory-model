import type { DispatchResult } from "../engine/dispatch";
import type { Command } from "../engine/commands";
import type { ModelEvent } from "../engine/events";
import type { CanonicalStore, CurrentAnalysisFile } from "../types";
import type {
  ActiveRerunCycle,
  AnalysisState,
  ClassificationResult,
  EvidenceProposal,
  PendingRevalidationApproval,
  PhaseExecution,
  PhaseResult,
  PromptRegistry,
} from "../types/analysis-pipeline";
import type {
  ConversationMessage,
  DiffReviewState,
} from "../types/conversation";

// ── Pipeline state snapshot (L1 pipeline data) ──

export interface PipelineSnapshot {
  analysis_state: AnalysisState | null;
  phase_results: Record<number, unknown>;
}

// ── Pipeline runtime snapshot (transient pipeline metadata) ──

export interface PipelineRuntimeSnapshot {
  prompt_registry: PromptRegistry;
  active_rerun_cycle: ActiveRerunCycle | null;
  pending_revalidation_approvals: Record<string, PendingRevalidationApproval>;
}

// ── Conversation snapshot (proposal review state) ──

export interface ConversationSnapshot {
  proposal_review: DiffReviewState;
}

// ── PipelineHost ──
//
// Single dependency-injection surface for the pipeline orchestrator.
// Merges the old OrchestratorDependencies (L1 canonical access, dispatch,
// conversation message emission) with every store function the orchestrator
// previously imported from ../store/*.

export interface PipelineHost {
  // ── L1 canonical access ──

  getCanonical(): CanonicalStore;
  getAnalysisFile(): CurrentAnalysisFile | null;
  getPersistedRevision(): number;
  getActiveAnalysisId(): string;
  resetAnalysisSession(): void;
  dispatch(
    command: Command,
    opts?: { dryRun?: boolean; source?: ModelEvent["source"] },
  ): DispatchResult;
  emitConversationMessage(
    message: Omit<ConversationMessage, "id" | "timestamp">,
  ): void;

  // ── Pipeline state (from store/pipeline) ──

  getPipelineState(): PipelineSnapshot;
  startPipelineAnalysis(params: {
    analysisId: string;
    description: string;
    domain: string;
    classification: ClassificationResult | null;
  }): AnalysisState;
  updateAnalysisState(
    updater: (state: AnalysisState | null) => AnalysisState | null,
  ): void;
  setPhaseResult(phase: number, result: PhaseResult | unknown): void;
  upsertPhaseExecution(execution: PhaseExecution): void;
  setPipelineProposalReview(review: DiffReviewState): void;
  addSteeringMessage(content: string): void;

  // ── Pipeline runtime (from store/pipeline-runtime) ──

  getPipelineRuntimeState(): PipelineRuntimeSnapshot;
  registerPendingRevalidationApproval(
    approval: PendingRevalidationApproval,
  ): void;
  clearPendingRevalidationApproval(eventId: string): void;
  setActiveRerunCycle(cycle: ActiveRerunCycle | null): void;
  updatePromptRegistry(
    updater: (registry: PromptRegistry) => PromptRegistry,
  ): void;

  // ── Derived state (from store/derived) ──

  getDerivedState(): {
    sensitivityByFormalizationAndSolver: Record<
      string,
      | Record<
          string,
          | {
              assumption_sensitivities: Array<{
                assumption_id: string;
                impact: "result_changes" | "result_stable";
                description: string;
                affected_payoffs: string[];
                statement: string;
              }>;
            }
          | undefined
        >
      | undefined
    >;
  };

  // ── Conversation (from store/conversation) ──

  getConversationState(): ConversationSnapshot;
  registerProposalGroup(params: {
    phase: number;
    content: string;
    proposals: EvidenceProposal[];
  }): void;
  getFirstPendingProposalPhase(maxPhase?: number): number | null;
  updateRevalidationActionStatus(
    eventId: string,
    resolution: "pending" | "approved" | "rerun_complete" | "dismissed",
  ): void;
  acceptAllPendingProposals(phase: number): number;
}
