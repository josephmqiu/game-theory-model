/**
 * PipelineHost implementation — bridges Zustand stores to the domain pipeline.
 * This is the single integration point between the renderer stores and the
 * pure domain orchestrator.
 */

import type { PipelineHost } from "shared/game-theory/pipeline/host";
import type { ConversationMessage } from "shared/game-theory/types/conversation";
import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { derivedStore } from "@/stores/derived-store";

export function createPipelineHostFromStores(): PipelineHost {
  return {
    // L1 canonical access
    getCanonical: () => analysisStore.getState().canonical,
    getAnalysisFile: () => null, // Will wire to file meta
    getPersistedRevision: () => analysisStore.getState().eventLog.cursor,
    getActiveAnalysisId: () =>
      pipelineStore.getState().analysis_state?.id ?? "",
    resetAnalysisSession: () => {
      analysisStore.getState().newAnalysis();
      pipelineStore.getState().resetPipeline();
      conversationStore.getState().resetConversation();
    },
    dispatch: (command, opts) =>
      analysisStore.getState().dispatch(command, opts),
    emitConversationMessage: (message) => {
      conversationStore
        .getState()
        .appendMessage(
          message as Omit<ConversationMessage, "id" | "timestamp">,
        );
    },

    // Pipeline state
    getPipelineState: () => ({
      analysis_state: pipelineStore.getState().analysis_state,
      phase_results: pipelineStore.getState().phase_results,
    }),
    startPipelineAnalysis: (params) =>
      pipelineStore.getState().startPipelineAnalysis(params),
    updateAnalysisState: (updater) =>
      pipelineStore.getState().updateAnalysisState(updater),
    setPhaseResult: (phase, result) =>
      pipelineStore.getState().setPhaseResult(phase, result),
    upsertPhaseExecution: (execution) =>
      pipelineStore.getState().upsertPhaseExecution(execution),
    setPipelineProposalReview: (review) =>
      pipelineStore.getState().setPipelineProposalReview(review),

    // Pipeline runtime
    getPipelineRuntimeState: () => ({
      prompt_registry: pipelineStore.getState().prompt_registry,
      active_rerun_cycle: pipelineStore.getState().active_rerun_cycle,
      pending_revalidation_approvals:
        pipelineStore.getState().pending_revalidation_approvals,
    }),
    registerPendingRevalidationApproval: (approval) =>
      pipelineStore.getState().registerPendingRevalidationApproval(approval),
    clearPendingRevalidationApproval: (eventId) =>
      pipelineStore.getState().clearPendingRevalidationApproval(eventId),
    setActiveRerunCycle: (cycle) =>
      pipelineStore.getState().setActiveRerunCycle(cycle),
    updatePromptRegistry: (updater) =>
      pipelineStore.getState().updatePromptRegistry(updater),

    // Conversation
    getConversationState: () => ({
      proposal_review: conversationStore.getState().proposal_review ?? {
        proposals: [],
        active_proposal_index: 0,
        merge_log: [],
      },
    }),
    registerProposalGroup: (params) =>
      conversationStore.getState().registerProposalGroup(params),
    getFirstPendingProposalPhase: (phase) =>
      conversationStore.getState().getFirstPendingProposalPhase(phase),
    updateRevalidationActionStatus: (eventId, status) =>
      conversationStore
        .getState()
        .updateRevalidationActionStatus(eventId, status),
    addSteeringMessage: (content) => {
      pipelineStore.getState().addSteeringMessage(content);
    },

    // Derived state
    getDerivedState: () => {
      const raw = derivedStore.getState().sensitivityByFormalizationAndSolver;
      const mapped: Record<
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
      > = {};
      for (const [fKey, solverMap] of Object.entries(raw)) {
        if (!solverMap) continue;
        const inner: Record<
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
        > = {};
        for (const [sKey, analysis] of Object.entries(solverMap)) {
          if (!analysis) continue;
          inner[sKey] = {
            assumption_sensitivities: analysis.sensitivities,
          };
        }
        mapped[fKey] = inner;
      }
      return { sensitivityByFormalizationAndSolver: mapped };
    },
  };
}
