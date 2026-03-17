import type { RevalidationEvent } from "../types/evidence";
import type {
  PendingRevalidationApproval,
  PipelinePhaseStatus,
  PromptVersion,
  RevalidationOutcome,
} from "../types/analysis-pipeline";
import type { PipelineHost } from "./host";
import { createRevalidationEngine } from "./revalidation-engine";
import { forkPrompt } from "./prompt-registry";
import {
  buildRevalidationActionCard,
  findMatchingOpenEvent,
  markPhasesForRerun,
  readPromptRegistry,
  restorePhaseStatuses,
} from "./orchestrator-helpers";

// ── Revalidation context ──
//
// Encapsulates all revalidation-related state and logic that closes over
// a PipelineHost. Created once by the orchestrator and passed to the
// methods that need it.

export interface RevalidationContext {
  listPendingRevalidations(): RevalidationEvent[];
  getCoveredPhases(excludedEventId?: string): Set<number>;
  reconcileRerunCycleState(): void;
  maybeCreateRevalidationEvent(phase: number, phaseOutput: unknown): void;
  approveRevalidation(eventId: string): Promise<RevalidationOutcome | null>;
  dismissRevalidation(eventId: string): void;
  getPromptRegistry(): ReturnType<
    PipelineHost["getPipelineRuntimeState"]
  >["prompt_registry"];
  forkPromptVersion(
    phase: number,
    params?: { name?: string; content?: string; description?: string },
  ): PromptVersion;
}

export function createRevalidationContext(
  host: PipelineHost,
): RevalidationContext {
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

  async function approveRevalidation(
    eventId: string,
  ): Promise<RevalidationOutcome | null> {
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
          status: "needs_rerun" as PipelinePhaseStatus,
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
  }

  function dismissRevalidation(eventId: string): void {
    const event = host.getCanonical().revalidation_events[eventId];
    if (!event || event.resolution !== "pending") {
      return;
    }

    const pendingApproval =
      host.getPipelineRuntimeState().pending_revalidation_approvals[eventId] ??
      null;
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
  }

  function getPromptRegistry() {
    return readPromptRegistry(host);
  }

  function forkPromptVersion(
    phase: number,
    params?: { name?: string; content?: string; description?: string },
  ): PromptVersion {
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
  }

  return {
    listPendingRevalidations,
    getCoveredPhases,
    reconcileRerunCycleState,
    maybeCreateRevalidationEvent,
    approveRevalidation,
    dismissRevalidation,
    getPromptRegistry,
    forkPromptVersion,
  };
}
