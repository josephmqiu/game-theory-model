import type {
  AssumptionExtractionResult,
  EliminationResult,
  EvidenceProposal,
  FormalizationResult,
  MetaCheckResult,
  PhaseExecution,
  PhaseResult,
  PipelineOrchestrator,
  ScenarioGenerationResult,
} from "../types/analysis-pipeline";
import type { PipelineHost } from "./host";
import { runPhase1Grounding, type Phase1Input } from "./phase-1-grounding";
import { runPhase2Players } from "./phase-2-players";
import { runPhase3Baseline, runPhase4History } from "./phase-3-4";
import { runPhase6Formalization } from "./phase-6-formalization";
import { runPhase7Assumptions } from "./phase-7-assumptions";
import { runPhase8Elimination } from "./phase-8-elimination";
import { runPhase9Scenarios } from "./phase-9-scenarios";
import { runPhase10MetaCheck } from "./phase-10-metacheck";
import {
  PHASE6_ALL_SUBSECTIONS,
  PHASE6_SUBSECTION_MESSAGES,
} from "./phase-6-subsections";
import { classifySituation } from "./helpers";
import { createRevalidationContext } from "./orchestrator-revalidation";
import {
  PHASE_NAMES,
  createPhaseExecution,
  readPhase1Input,
  readPhase2Input,
  readPhase6Input,
  readPromptRegistry,
  requirePhasePrerequisite,
  setPhaseFinished,
  setPhaseRunning,
} from "./orchestrator-helpers";

export function createPipelineOrchestrator(
  host: PipelineHost,
): PipelineOrchestrator {
  const reval = createRevalidationContext(host);

  return {
    async startAnalysis(description, options) {
      const currentAnalysis = host.getPipelineState().analysis_state;
      const replacingAnalysis = Boolean(
        currentAnalysis && currentAnalysis.event_description !== description,
      );
      if (replacingAnalysis) {
        host.resetAnalysisSession();
      }

      const classification = classifySituation(description);
      const analysisState = host.startPipelineAnalysis({
        analysisId: host.getActiveAnalysisId(),
        description,
        domain: classification.domain,
        classification,
      });

      host.emitConversationMessage({
        role: "ai",
        content: options?.manual
          ? "Manual mode is active. Use the phase screens to build the model without an MCP client."
          : replacingAnalysis
            ? `Replaced the active analysis with: ${description}`
            : `Starting analysis of: ${description}`,
        message_type: "phase_transition",
        phase: 1,
      });

      return analysisState;
    },

    async runFullAnalysis(description) {
      const analysisState = await this.startAnalysis(description, {
        manual: false,
      });

      for (let phase = 1; phase <= 10; phase += 1) {
        try {
          // In full-auto mode, dismiss pending revalidations and ensure
          // the previous phase is not stuck in "needs_rerun" before we
          // attempt the next phase.
          for (const pending of reval.listPendingRevalidations()) {
            reval.dismissRevalidation(pending.id);
          }
          if (phase > 1) {
            host.updateAnalysisState((state) => {
              if (!state) return state;
              const priorStatus = state.phase_states[phase - 1]?.status;
              if (
                priorStatus === "needs_rerun" ||
                priorStatus === "review_needed"
              ) {
                return {
                  ...state,
                  phase_states: {
                    ...state.phase_states,
                    [phase - 1]: {
                      ...state.phase_states[phase - 1],
                      status: "complete",
                    },
                  },
                };
              }
              return state;
            });
          }

          const result = await this.runPhase(phase);
          host.acceptAllPendingProposals(phase);

          if (result.status === "failed") {
            host.emitConversationMessage({
              role: "ai",
              content: `Full analysis stopped at Phase ${phase}: ${result.error ?? "phase failed"}.`,
              message_type: "phase_transition",
              phase,
            });
            return host.getPipelineState().analysis_state ?? analysisState;
          }
        } catch (error) {
          host.emitConversationMessage({
            role: "ai",
            content: `Full analysis stopped at Phase ${phase}: ${error instanceof Error ? error.message : "unexpected error"}.`,
            message_type: "phase_transition",
            phase,
          });
          return host.getPipelineState().analysis_state ?? analysisState;
        }
      }

      host.updateAnalysisState((state) =>
        state
          ? {
              ...state,
              status: "complete",
              completed_at: new Date().toISOString(),
            }
          : state,
      );

      host.emitConversationMessage({
        role: "ai",
        content: "Full analysis complete. All 10 phases finished.",
        message_type: "phase_transition",
        phase: 10,
      });

      return host.getPipelineState().analysis_state ?? analysisState;
    },

    async runPhase(phase, input) {
      requirePhasePrerequisite(host, phase);

      const analysisState = host.getPipelineState().analysis_state;
      if (!analysisState) {
        throw new Error(
          "No active analysis. Start an analysis before running phases.",
        );
      }

      const phaseExecution = createPhaseExecution(host, phase);
      host.upsertPhaseExecution(phaseExecution);
      setPhaseRunning(host, phase, phaseExecution.id);
      host.emitConversationMessage({
        role: "ai",
        content: `Starting Phase ${phase}: ${PHASE_NAMES[phase]}...`,
        message_type: "phase_transition",
        phase,
      });

      const baseRevision = host.getPersistedRevision();
      const canonical = host.getCanonical();
      let result: PhaseResult;
      let proposals: EvidenceProposal[] = [];
      let phaseOutput: unknown = null;

      if (phase === 1) {
        const output = runPhase1Grounding(
          {
            situation_description: analysisState.event_description,
            ...readPhase1Input(input),
          } satisfies Phase1Input,
          { canonical, baseRevision, phaseExecution },
        );
        phaseOutput = output.result;
        result = output.result.status;
        proposals = output.result.proposals;
        host.setPhaseResult(1, output.result);
        host.updateAnalysisState((state) =>
          state ? { ...state, classification: output.classification } : state,
        );
      } else if (phase === 2) {
        const output = runPhase2Players(readPhase2Input(input), {
          canonical,
          analysisState,
          baseRevision,
          phaseExecution,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(2, output);
      } else if (phase === 3) {
        const output = runPhase3Baseline({
          canonical,
          analysisState,
          baseRevision,
          phaseExecution,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(3, output);
      } else if (phase === 4) {
        const output = runPhase4History({
          canonical,
          analysisState,
          baseRevision,
          phaseExecution,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(4, output);
      } else if (phase === 5) {
        const pendingEvents = reval.listPendingRevalidations();
        const activeRerunCycle =
          host.getPipelineRuntimeState().active_rerun_cycle;
        const hasOpenRevalidation =
          pendingEvents.length > 0 || activeRerunCycle != null;
        const output = {
          phase: 5,
          status: {
            status: hasOpenRevalidation ? "partial" : "complete",
            phase: 5,
            execution_id: phaseExecution.id,
            retriable: true,
          } satisfies PhaseResult,
          pending_events: pendingEvents,
          active_rerun_cycle: activeRerunCycle,
          prompt_registry: readPromptRegistry(host),
        };
        phaseOutput = output;
        result = output.status;
        host.setPhaseResult(5, output);
      } else if (phase === 6) {
        const phase6Input = readPhase6Input(input);
        const subsections = phase6Input.subsections?.length
          ? phase6Input.subsections
          : PHASE6_ALL_SUBSECTIONS;

        for (const subsection of subsections) {
          host.emitConversationMessage({
            role: "ai",
            content:
              PHASE6_SUBSECTION_MESSAGES[subsection] ??
              `Running ${subsection}...`,
            message_type: "finding",
            phase: 6,
          });
        }

        const output = runPhase6Formalization(phase6Input, {
          canonical,
          analysisState,
          baseRevision,
          phaseExecution,
          phaseResults: host.getPipelineState().phase_results,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(6, output);
      } else if (phase === 7) {
        const output = runPhase7Assumptions({
          canonical,
          baseRevision,
          phaseExecution,
          phaseResults: host.getPipelineState().phase_results,
          getDerivedState: () => host.getDerivedState(),
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(7, output);
      } else if (phase === 8) {
        const output = runPhase8Elimination({
          canonical,
          baseRevision,
          phaseExecution,
          phaseResults: host.getPipelineState().phase_results,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(8, output);
      } else if (phase === 9) {
        const output = runPhase9Scenarios({
          canonical,
          baseRevision,
          phaseExecution,
          phaseResults: host.getPipelineState().phase_results,
        });
        phaseOutput = output;
        result = output.status;
        proposals = output.proposals;
        host.setPhaseResult(9, output);
      } else if (phase === 10) {
        const output = runPhase10MetaCheck({
          canonical,
          baseRevision,
          phaseExecution,
          phaseResults: host.getPipelineState().phase_results,
        });
        phaseOutput = output;
        result = output.status;
        proposals =
          "proposals" in output
            ? (output as { proposals: typeof proposals }).proposals
            : [];
        host.setPhaseResult(10, output);
      } else {
        result = {
          status: "failed",
          phase,
          execution_id: phaseExecution.id,
          retriable: true,
          error: `Phase ${phase} is not implemented in this milestone.`,
        };
      }

      const completedExecution: PhaseExecution = {
        ...phaseExecution,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(phaseExecution.started_at).getTime(),
        status: result.status === "failed" ? "failed" : "complete",
        error: result.error ?? null,
      };
      host.upsertPhaseExecution(completedExecution);

      emitPhaseCompletionMessage(host, reval, phase, phaseOutput, proposals);

      setPhaseFinished(
        host,
        phase,
        phaseExecution.id,
        result.status === "failed"
          ? "needs_rerun"
          : proposals.length > 0 || result.status === "partial"
            ? "review_needed"
            : "complete",
        proposals.length > 0 || result.status === "partial",
      );

      if (
        phaseOutput &&
        phase >= 2 &&
        phase <= 10 &&
        result.status !== "failed"
      ) {
        reval.maybeCreateRevalidationEvent(phase, phaseOutput);
      }

      reval.reconcileRerunCycleState();

      return result;
    },

    async approveRevalidation(eventId) {
      return reval.approveRevalidation(eventId);
    },

    dismissRevalidation(eventId) {
      reval.dismissRevalidation(eventId);
    },

    reconcileActiveRerunCycle() {
      reval.reconcileRerunCycleState();
    },

    getPendingRevalidations() {
      return reval.listPendingRevalidations();
    },

    getPromptRegistry() {
      return reval.getPromptRegistry();
    },

    forkPromptVersion(phase, params) {
      return reval.forkPromptVersion(phase, params);
    },

    pause() {
      host.updateAnalysisState((analysisState) =>
        analysisState ? { ...analysisState, status: "paused" } : analysisState,
      );
    },

    resume() {
      host.updateAnalysisState((analysisState) =>
        analysisState ? { ...analysisState, status: "running" } : analysisState,
      );
    },

    cancelCurrentPhase() {
      host.updateAnalysisState((analysisState) =>
        analysisState
          ? { ...analysisState, current_phase: null, status: "paused" }
          : analysisState,
      );
    },

    getState() {
      return host.getPipelineState().analysis_state;
    },

    async handleSteering(message) {
      host.addSteeringMessage(message);
      host.emitConversationMessage({
        role: "ai",
        content: `Steering noted: ${message}`,
        message_type: "steering_ack",
        phase:
          host.getPipelineState().analysis_state?.current_phase ?? undefined,
      });
    },
  };
}

// ── Phase completion message routing ──

function emitPhaseCompletionMessage(
  host: PipelineHost,
  reval: ReturnType<typeof createRevalidationContext>,
  phase: number,
  phaseOutput: unknown,
  proposals: EvidenceProposal[],
): void {
  if (
    phase === 6 &&
    phaseOutput &&
    (phaseOutput as FormalizationResult).proposal_groups
  ) {
    const proposalGroups = (phaseOutput as FormalizationResult).proposal_groups;
    for (const group of proposalGroups) {
      host.registerProposalGroup({
        phase,
        content: group.content,
        proposals: group.proposals,
      });
    }
    if (proposalGroups.length === 0) {
      host.emitConversationMessage({
        role: "ai",
        content:
          "Phase 6 complete. No canonical mutations were proposed in this pass.",
        message_type: "result",
        phase,
      });
    }
    host.setPipelineProposalReview(host.getConversationState().proposal_review);
  } else if (phase === 7 && phaseOutput) {
    const phase7Output = phaseOutput as AssumptionExtractionResult;
    if (phase7Output.proposals.length > 0) {
      host.registerProposalGroup({
        phase,
        content: `Phase 7 complete. Review ${phase7Output.proposals.length} proposal${phase7Output.proposals.length === 1 ? "" : "s"} before continuing.`,
        proposals: phase7Output.proposals,
      });
      host.setPipelineProposalReview(
        host.getConversationState().proposal_review,
      );
    } else {
      host.emitConversationMessage({
        role: "ai",
        content: `Phase 7 complete. Extracted ${phase7Output.assumptions.length} assumptions across ${phase7Output.correlated_clusters.length} correlated cluster${phase7Output.correlated_clusters.length === 1 ? "" : "s"}.`,
        message_type: "result",
        phase,
      });
    }
  } else if (phase === 8 && phaseOutput) {
    const phase8Output = phaseOutput as EliminationResult;
    if (phase8Output.proposals.length > 0) {
      host.registerProposalGroup({
        phase,
        content: `Phase 8 complete. ${phase8Output.eliminated_outcomes.length} outcome(s) eliminated. Review ${phase8Output.proposals.length} proposal(s).`,
        proposals: phase8Output.proposals,
      });
      host.setPipelineProposalReview(
        host.getConversationState().proposal_review,
      );
    } else {
      host.emitConversationMessage({
        role: "ai",
        content: `Phase 8 complete. No outcomes eliminated in this pass.`,
        message_type: "result",
        phase,
      });
    }
  } else if (phase === 9 && phaseOutput) {
    const phase9Output = phaseOutput as ScenarioGenerationResult;
    if (phase9Output.proposals.length > 0) {
      host.registerProposalGroup({
        phase,
        content: `Phase 9 complete. Central thesis: "${phase9Output.central_thesis.statement}". ${phase9Output.proposed_scenarios.length} scenario(s), ${phase9Output.tail_risks.length} tail risk(s). Review ${phase9Output.proposals.length} proposal(s).`,
        proposals: phase9Output.proposals,
      });
      host.setPipelineProposalReview(
        host.getConversationState().proposal_review,
      );
    } else {
      host.emitConversationMessage({
        role: "ai",
        content: `Phase 9 complete with no proposals.`,
        message_type: "result",
        phase,
      });
    }
  } else if (phase === 10 && phaseOutput) {
    const phase10Output = phaseOutput as MetaCheckResult;
    host.emitConversationMessage({
      role: "ai",
      content: phase10Output.analysis_complete
        ? `Phase 10 complete. Analysis is complete. Overall assessment: ${phase10Output.adversarial_result.overall_assessment}.`
        : `Phase 10 complete. Analysis is NOT yet complete — review final test gaps and meta-check concerns.`,
      message_type: "result",
      phase,
    });
  } else if (proposals.length > 0) {
    host.registerProposalGroup({
      phase,
      content: `Phase ${phase} complete. Review ${proposals.length} proposal${proposals.length === 1 ? "" : "s"} before continuing.`,
      proposals,
    });
    host.setPipelineProposalReview(host.getConversationState().proposal_review);
  } else {
    host.emitConversationMessage({
      role: "ai",
      content:
        phase === 5
          ? `Phase 5 dashboard refreshed. ${reval.listPendingRevalidations().length} revalidation event(s) are pending.`
          : `Phase ${phase} complete with no proposals.`,
      message_type: "result",
      phase,
    });
  }
}
