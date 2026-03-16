import type { CanonicalStore } from "../types";
import type { RevalidationEvent } from "../types/evidence";
import type {
  AssumptionExtractionResult,
  EliminationResult,
  EvidenceProposal,
  FormalizationResult,
  MetaCheckResult,
  PendingRevalidationApproval,
  PhaseExecution,
  PhaseResult,
  PhaseRunInput,
  Phase6RunInput,
  PipelineOrchestrator,
  PipelinePhaseStatus,
  PromptRegistry,
  PromptVersion,
  RevalidationCheck,
  ScenarioGenerationResult,
} from "../types/analysis-pipeline";
import type { RevalidationActionCard } from "../types/conversation";
import type { PipelineHost } from "./host";
import { runPhase1Grounding, type Phase1Input } from "./phase-1-grounding";
import { runPhase2Players, type Phase2Input } from "./phase-2-players";
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
import { classifySituation, createEntityId } from "./helpers";
import { createRevalidationEngine } from "./revalidation-engine";
import { forkPrompt, getActivePrompt } from "./prompt-registry";

const PHASE_NAMES: Record<number, string> = {
  1: "Situational Grounding",
  2: "Player Identification",
  3: "Baseline Strategic Model",
  4: "Historical Repeated Game",
  5: "Recursive Revalidation",
  6: "Full Formalization",
  7: "Assumption Extraction",
  8: "Elimination",
  9: "Scenario Generation",
  10: "Meta-check",
};

function readPromptRegistry(host: PipelineHost): PromptRegistry {
  return host.getPipelineRuntimeState().prompt_registry;
}

function createPhaseExecution(
  host: PipelineHost,
  phase: number,
): PhaseExecution {
  const prompt = getActivePrompt(readPromptRegistry(host), phase);
  return {
    id: createEntityId("phase_execution"),
    phase,
    pass_number: host.getPipelineState().analysis_state?.pass_number ?? 1,
    provider_id: "browser-fallback",
    model_id: "heuristic-m6",
    prompt_version_id: prompt.id,
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    status: "running",
    error: null,
  };
}

function setPhaseRunning(
  host: PipelineHost,
  phase: number,
  executionId: string,
): void {
  const now = new Date().toISOString();
  const activeCycle = host.getPipelineRuntimeState().active_rerun_cycle;
  if (activeCycle && activeCycle.target_phases.includes(phase)) {
    host.setActiveRerunCycle({
      ...activeCycle,
      status: "running",
    });
  }

  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    return {
      ...analysisState,
      current_phase: phase,
      status: "running",
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status: "running",
          started_at: now,
          pass_number: analysisState.pass_number,
          phase_execution_id: executionId,
        },
      },
    };
  });
}

function setPhaseFinished(
  host: PipelineHost,
  phase: number,
  executionId: string,
  status: Extract<
    PipelinePhaseStatus,
    "review_needed" | "complete" | "needs_rerun"
  >,
  paused = true,
): void {
  const now = new Date().toISOString();
  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    return {
      ...analysisState,
      current_phase: null,
      status: paused ? "paused" : "running",
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status,
          completed_at: now,
          phase_execution_id: executionId,
        },
      },
    };
  });
}

function readPhase1Input(
  input?: PhaseRunInput,
): Pick<Phase1Input, "focus_areas"> {
  return input && "focus_areas" in input
    ? { focus_areas: input.focus_areas }
    : {};
}

function readPhase2Input(input?: PhaseRunInput): Phase2Input {
  return input && "additional_context" in input
    ? { additional_context: input.additional_context }
    : {};
}

function readPhase6Input(input?: PhaseRunInput): Phase6RunInput {
  return input && "subsections" in input
    ? { subsections: input.subsections }
    : {};
}

function requirePhasePrerequisite(host: PipelineHost, phase: number): void {
  if (phase === 5) {
    return;
  }

  const blockingPhase = host.getFirstPendingProposalPhase(phase);
  if (blockingPhase != null) {
    throw new Error(
      `Phase ${blockingPhase} proposals are still pending review.`,
    );
  }

  if (phase === 1) {
    return;
  }

  const analysisState = host.getPipelineState().analysis_state;
  if (!analysisState) {
    throw new Error(
      `Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`,
    );
  }

  const priorState = analysisState.phase_states[phase - 1];
  const phaseReady =
    priorState?.status === "complete" || priorState?.status === "review_needed";
  if (!priorState || !phaseReady) {
    throw new Error(
      `Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`,
    );
  }
}

function sameTargets(left: number[], right: number[]): boolean {
  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function sameRefs(
  left: ReadonlyArray<{ type: string; id: string }>,
  right: ReadonlyArray<{ type: string; id: string }>,
): boolean {
  const normalize = (refs: ReadonlyArray<{ type: string; id: string }>) =>
    refs.map((ref) => `${ref.type}:${ref.id}`).sort();
  const leftKeys = normalize(left);
  const rightKeys = normalize(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((value, index) => value === rightKeys[index])
  );
}

function buildRevalidationActionCard(
  event: RevalidationEvent,
): RevalidationActionCard {
  return {
    event_id: event.id,
    trigger_condition: event.trigger_condition,
    source_phase: event.source_phase,
    target_phases: event.target_phases,
    description: event.description,
    pass_number: event.pass_number,
    resolution: event.resolution,
    entity_refs: event.entity_refs,
  };
}

function findMatchingOpenEvent(
  trigger: RevalidationEvent["trigger_condition"],
  phase: number,
  affectedPhases: number[],
  affectedEntities: RevalidationCheck["affected_entities"],
  canonical: CanonicalStore,
): RevalidationEvent | null {
  return (
    Object.values(canonical.revalidation_events).find(
      (event) =>
        (event.resolution === "pending" || event.resolution === "approved") &&
        event.source_phase === phase &&
        event.trigger_condition === trigger &&
        sameTargets(event.target_phases, affectedPhases) &&
        sameRefs(event.entity_refs, affectedEntities),
    ) ?? null
  );
}

function markPhasesForRerun(
  host: PipelineHost,
  phases: number[],
): Partial<Record<number, PipelinePhaseStatus>> {
  const previousStatuses: Partial<Record<number, PipelinePhaseStatus>> = {};

  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    const phase_states = { ...analysisState.phase_states };
    for (const phase of phases) {
      const current = phase_states[phase];
      if (!current) {
        continue;
      }
      previousStatuses[phase] = current.status;
      phase_states[phase] = {
        ...current,
        status: "needs_rerun",
      };
    }

    return {
      ...analysisState,
      current_phase: null,
      status: "paused",
      phase_states,
    };
  });

  return previousStatuses;
}

function restorePhaseStatuses(
  host: PipelineHost,
  previousStatuses: Partial<Record<number, PipelinePhaseStatus>>,
  preservedPhases: ReadonlySet<number>,
): void {
  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    const phase_states = { ...analysisState.phase_states };
    for (const [phaseKey, status] of Object.entries(previousStatuses)) {
      const phase = Number(phaseKey);
      if (!phase_states[phase] || !status || preservedPhases.has(phase)) {
        continue;
      }
      phase_states[phase] = {
        ...phase_states[phase],
        status,
      };
    }

    return {
      ...analysisState,
      phase_states,
    };
  });
}

export function createPipelineOrchestrator(
  host: PipelineHost,
): PipelineOrchestrator {
  const revalidationEngine = createRevalidationEngine({
    getCanonical: () => host.getCanonical(),
    getAnalysisState: () => host.getPipelineState().analysis_state,
    getDerivedState: () => host.getDerivedState(),
    getPendingApproval: (eventId) =>
      host.getPipelineRuntimeState().pending_revalidation_approvals[eventId] ??
      null,
    clearPendingApproval: (eventId) =>
      host.clearPendingRevalidationApproval(eventId),
    setActiveRerunCycle: (cycle) => host.setActiveRerunCycle(cycle),
  });

  function listPendingRevalidations(): RevalidationEvent[] {
    return revalidationEngine
      .getRevalidationLog(host.getActiveAnalysisId())
      .filter((event) => event.resolution === "pending");
  }

  function getCoveredPhases(excludedEventId?: string): Set<number> {
    const covered = new Set<number>();
    const runtime = host.getPipelineRuntimeState();

    for (const pendingApproval of Object.values(
      runtime.pending_revalidation_approvals,
    )) {
      if (pendingApproval.event_id === excludedEventId) {
        continue;
      }
      for (const phase of pendingApproval.target_phases) {
        covered.add(phase);
      }
    }

    const activeCycle = runtime.active_rerun_cycle;
    if (activeCycle && activeCycle.event_id !== excludedEventId) {
      for (const phase of activeCycle.target_phases) {
        covered.add(phase);
      }
    }

    return covered;
  }

  function finalizeActiveRerunCycle(
    event: RevalidationEvent,
    passNumber: number,
  ): void {
    const alreadyComplete = event.resolution === "rerun_complete";
    if (!alreadyComplete) {
      host.dispatch(
        {
          kind: "update_revalidation_event",
          payload: {
            id: event.id,
            resolution: "rerun_complete",
          },
        },
        { source: "ai_merge" },
      );

      host.emitConversationMessage({
        role: "ai",
        content: `Revalidation rerun complete for event ${event.id}. Pass ${passNumber} has no remaining queued reruns.`,
        message_type: "revalidation",
        phase: 5,
        structured_content: {
          revalidation_actions: [
            buildRevalidationActionCard({
              ...event,
              resolution: "rerun_complete",
            }),
          ],
          entity_refs: event.entity_refs,
        },
      });
      host.updateRevalidationActionStatus(event.id, "rerun_complete");
    }

    host.setActiveRerunCycle(null);
  }

  function reconcileRerunCycleState(): void {
    const activeCycle = host.getPipelineRuntimeState().active_rerun_cycle;
    if (!activeCycle) {
      return;
    }

    const analysisState = host.getPipelineState().analysis_state;
    if (!analysisState) {
      return;
    }

    const incompletePhases = activeCycle.target_phases.filter(
      (phase) => analysisState.phase_states[phase]?.status !== "complete",
    );

    if (incompletePhases.length === 0) {
      const event =
        host.getCanonical().revalidation_events[activeCycle.event_id];
      if (event) {
        finalizeActiveRerunCycle(event, activeCycle.pass_number);
      } else {
        host.setActiveRerunCycle(null);
      }
      return;
    }

    const statuses = incompletePhases.map(
      (phase) => analysisState.phase_states[phase]?.status ?? "pending",
    );
    const nextStatus = statuses.some(
      (status) => status === "running" || status === "review_needed",
    )
      ? "running"
      : "queued";
    const earliest_phase = Math.min(...incompletePhases);

    if (
      activeCycle.status !== nextStatus ||
      activeCycle.earliest_phase !== earliest_phase
    ) {
      host.setActiveRerunCycle({
        ...activeCycle,
        earliest_phase,
        status: nextStatus,
      });
    }
  }

  function emitRevalidationMessage(
    event: RevalidationEvent,
    suffix?: string,
  ): void {
    const currentPass =
      host.getPipelineState().analysis_state?.pass_number ?? 1;
    const convergenceWarning =
      currentPass >= 4
        ? ` Analysis has not converged after ${currentPass} passes. Review whether the abstraction is still correct.`
        : "";

    host.emitConversationMessage({
      role: "ai",
      content: `${event.description}${suffix ? ` ${suffix}` : ""}${convergenceWarning}`,
      message_type: "revalidation",
      phase: 5,
      structured_content: {
        revalidation_actions: [buildRevalidationActionCard(event)],
        entity_refs: event.entity_refs,
      },
    });
  }

  function maybeCreateRevalidationEvent(
    phase: number,
    phaseOutput: unknown,
  ): void {
    const check = revalidationEngine.checkTriggers(phaseOutput, phase);
    if (check.triggers_found.length === 0 || check.recommendation === "none") {
      return;
    }

    if (check.recommendation === "monitor") {
      host.emitConversationMessage({
        role: "ai",
        content: `Phase ${phase} surfaced monitoring signals: ${check.description}`,
        message_type: "revalidation",
        phase: 5,
      });
      return;
    }

    const canonicalBefore = host.getCanonical();
    const uniqueTriggers = [...new Set(check.triggers_found)];
    const existingEvents = uniqueTriggers
      .map((trigger) =>
        findMatchingOpenEvent(
          trigger,
          phase,
          check.affected_phases,
          check.affected_entities,
          canonicalBefore,
        ),
      )
      .filter((event): event is RevalidationEvent => event != null);
    const triggersToCreate = uniqueTriggers.filter(
      (trigger) =>
        !existingEvents.some((event) => event.trigger_condition === trigger),
    );

    if (triggersToCreate.length === 0) {
      const [existing] = existingEvents;
      if (existing) {
        emitRevalidationMessage(
          existing,
          existing.resolution === "approved"
            ? "A matching revalidation event is already approved and in progress."
            : "A matching revalidation event is already pending approval.",
        );
      }
      return;
    }

    const priorEventIds = new Set(
      Object.keys(canonicalBefore.revalidation_events),
    );
    const dispatchResult = host.dispatch(
      {
        kind: "batch",
        label: `Phase ${phase} revalidation trigger`,
        commands: [
          ...triggersToCreate.map((trigger_condition) => ({
            kind: "trigger_revalidation" as const,
            payload: {
              trigger_condition,
              source_phase: phase,
              target_phases: check.affected_phases,
              entity_refs: check.affected_entities,
              description: check.description,
              pass_number: revalidationEngine.getCurrentPass(),
            },
          })),
          ...check.affected_entities.map((ref) => ({
            kind: "mark_stale" as const,
            payload: {
              id: ref.id,
              reason: `Revalidation triggered after Phase ${phase}: ${check.description}`,
            },
          })),
        ],
      },
      { source: "ai_merge" },
    );

    if (dispatchResult.status !== "committed") {
      const errorMessage =
        dispatchResult.status === "rejected"
          ? dispatchResult.errors.join(" ")
          : "Dispatch returned a dry-run result while recording revalidation.";
      host.emitConversationMessage({
        role: "ai",
        content: `Revalidation trigger could not be recorded: ${errorMessage}`,
        message_type: "revalidation",
        phase: 5,
      });
      return;
    }

    const canonicalAfter = host.getCanonical();
    const newEvents = Object.values(canonicalAfter.revalidation_events).filter(
      (event) => !priorEventIds.has(event.id),
    );

    if (newEvents.length === 0) {
      return;
    }

    const previousStatuses = markPhasesForRerun(host, check.affected_phases);
    for (const newEvent of newEvents) {
      const pendingApproval: PendingRevalidationApproval = {
        event_id: newEvent.id,
        source_phase: phase,
        target_phases: newEvent.target_phases,
        affected_entities: check.affected_entities,
        previous_phase_statuses: previousStatuses,
        created_at: new Date().toISOString(),
      };
      host.registerPendingRevalidationApproval(pendingApproval);
      emitRevalidationMessage(
        newEvent,
        "Approve to queue the rerun or dismiss to keep the current pass.",
      );
    }
  }

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
        const pendingEvents = listPendingRevalidations();
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

      if (
        phase === 6 &&
        phaseOutput &&
        (phaseOutput as FormalizationResult).proposal_groups
      ) {
        const proposalGroups = (phaseOutput as FormalizationResult)
          .proposal_groups;
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
        host.setPipelineProposalReview(
          host.getConversationState().proposal_review,
        );
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
        host.setPipelineProposalReview(
          host.getConversationState().proposal_review,
        );
      } else {
        host.emitConversationMessage({
          role: "ai",
          content:
            phase === 5
              ? `Phase 5 dashboard refreshed. ${listPendingRevalidations().length} revalidation event(s) are pending.`
              : `Phase ${phase} complete with no proposals.`,
          message_type: "result",
          phase,
        });
      }

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
        maybeCreateRevalidationEvent(phase, phaseOutput);
      }

      reconcileRerunCycleState();

      return result;
    },

    async approveRevalidation(eventId) {
      const event = host.getCanonical().revalidation_events[eventId];
      if (!event || event.resolution !== "pending") {
        return null;
      }

      const outcome = await revalidationEngine.executeRevalidation(event);
      host.dispatch(
        {
          kind: "update_revalidation_event",
          payload: {
            id: event.id,
            resolution: "approved",
          },
        },
        { source: "ai_merge" },
      );
      host.updateAnalysisState((analysisState) => {
        if (!analysisState) {
          return analysisState;
        }

        const phase_states = { ...analysisState.phase_states };
        for (const phase of event.target_phases) {
          if (!phase_states[phase]) {
            continue;
          }
          phase_states[phase] = {
            ...phase_states[phase],
            status: "needs_rerun",
            pass_number: outcome.new_pass_number,
          };
        }

        return {
          ...analysisState,
          pass_number: outcome.new_pass_number,
          status: "paused",
          phase_states,
        };
      });

      host.emitConversationMessage({
        role: "ai",
        content: `Approved revalidation for event ${event.id}. Pass ${outcome.new_pass_number} is queued from Phase ${Math.min(...event.target_phases)}.`,
        message_type: "revalidation",
        phase: 5,
        structured_content: {
          revalidation_actions: [
            buildRevalidationActionCard({
              ...event,
              resolution: "approved",
            }),
          ],
          entity_refs: event.entity_refs,
        },
      });
      host.updateRevalidationActionStatus(event.id, "approved");
      reconcileRerunCycleState();

      return outcome;
    },

    dismissRevalidation(eventId) {
      const event = host.getCanonical().revalidation_events[eventId];
      if (!event || event.resolution !== "pending") {
        return;
      }

      const pendingApproval =
        host.getPipelineRuntimeState().pending_revalidation_approvals[
          eventId
        ] ?? null;
      host.dispatch(
        {
          kind: "update_revalidation_event",
          payload: {
            id: event.id,
            resolution: "dismissed",
          },
        },
        { source: "ai_merge" },
      );

      if (pendingApproval) {
        restorePhaseStatuses(
          host,
          pendingApproval.previous_phase_statuses,
          getCoveredPhases(eventId),
        );
      }

      host.clearPendingRevalidationApproval(eventId);
      if (
        host.getPipelineRuntimeState().active_rerun_cycle?.event_id === eventId
      ) {
        host.setActiveRerunCycle(null);
      }

      host.emitConversationMessage({
        role: "ai",
        content: `Dismissed revalidation event ${event.id}. Stale markers remain visible, but queued reruns were cleared.`,
        message_type: "revalidation",
        phase: 5,
        structured_content: {
          revalidation_actions: [
            buildRevalidationActionCard({
              ...event,
              resolution: "dismissed",
            }),
          ],
          entity_refs: event.entity_refs,
        },
      });
      host.updateRevalidationActionStatus(event.id, "dismissed");
      reconcileRerunCycleState();
    },

    reconcileActiveRerunCycle() {
      reconcileRerunCycleState();
    },

    getPendingRevalidations() {
      return listPendingRevalidations();
    },

    getPromptRegistry() {
      return readPromptRegistry(host);
    },

    forkPromptVersion(phase, params) {
      let nextVersion: PromptVersion | null = null;
      host.updatePromptRegistry((registry) => {
        const forked = forkPrompt(registry, phase, params);
        nextVersion = forked.version;
        return forked.registry;
      });

      if (!nextVersion) {
        throw new Error(`Could not fork prompt for Phase ${phase}.`);
      }

      return nextVersion;
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
