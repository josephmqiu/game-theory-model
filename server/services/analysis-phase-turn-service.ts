import type { RunKind } from "../../shared/types/api";
import type { PhaseSummary, AnalysisProgressEvent } from "../../shared/types/events";
import type { RuntimeProvider, ResolvedAnalysisRuntime } from "../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type { RunSummaryState } from "../../shared/types/workspace-state";
import { nanoid } from "nanoid";
import * as entityGraphService from "./entity-graph-service";
import { createPhaseTurnThreadWriter } from "./analysis-thread-turn";
import { buildPhaseBrief } from "./analysis-phase-brief";
import { buildPhasePromptBundle } from "./analysis-prompt-provenance";
import { PHASE_ENTITY_TYPES } from "./analysis-entity-schemas";
import { runPhaseWithTools } from "./analysis-service";
import {
  beginPhaseTransaction,
  commitPhaseTransaction,
  rollbackPhaseTransaction,
} from "./revision-diff";
import {
  getProviderSessionBinding,
  getWorkspaceDatabase,
  upsertProviderSessionBinding,
} from "./workspace";
import type { AnalysisWriteContext } from "./analysis-tools";
import type { AnyDomainEventInput, DomainEventInputBare } from "./workspace/domain-event-types";
import type { RunLogger } from "../utils/ai-logger";

function appendRunEvents(
  input: {
    workspaceId: string;
    threadId: string;
    runId: string;
    producer: string;
  },
  events: DomainEventInputBare[],
): void {
  getWorkspaceDatabase().eventStore.appendEvents(
    events.map(
      (event) =>
        ({
          ...event,
          kind: "explicit" as const,
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          runId: input.runId,
          producer: input.producer,
        }) as AnyDomainEventInput,
    ),
  );
}

function buildRunSummaryState(
  statusMessage: string,
  completedPhases: number,
  failedPhase?: MethodologyPhase,
): RunSummaryState {
  return {
    statusMessage,
    failedPhase,
    completedPhases,
  };
}

function titleCasePhase(phase: MethodologyPhase): string {
  return phase
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildVisiblePhaseUserMessage(input: {
  phase: MethodologyPhase;
  phaseNumber: number;
  objective: string;
  doneCondition: string;
  phaseBrief: string;
}): string {
  return [
    `Phase ${input.phaseNumber}: ${titleCasePhase(input.phase)}`,
    "",
    `Objective: ${input.objective}`,
    `Done when: ${input.doneCondition}`,
    "",
    "Execution brief:",
    input.phaseBrief,
  ].join("\n");
}

function buildFallbackAssistantSummary(input: {
  phase: MethodologyPhase;
  summary?: PhaseSummary;
  error?: string;
}): string {
  if (input.error) {
    return `Phase ${titleCasePhase(input.phase)} could not complete: ${input.error}`;
  }

  return [
    `Completed ${titleCasePhase(input.phase)}.`,
    input.summary
      ? `Created ${input.summary.entitiesCreated} entities, updated ${input.summary.entitiesUpdated} entities, and created ${input.summary.relationshipsCreated} relationships in ${input.summary.durationMs}ms.`
      : "The phase completed successfully.",
  ].join(" ");
}

export interface ExecutePhaseTurnContext {
  runId: string;
  runKind: RunKind;
  workspaceId: string;
  threadId: string;
  activePhases: MethodologyPhase[];
  completedPhases: MethodologyPhase[];
  progressCompletedBefore: number;
  progressTotal: number;
  phaseTurnCounts: Partial<Record<MethodologyPhase, number>>;
  provider?: RuntimeProvider;
  model?: string;
  runtime: ResolvedAnalysisRuntime;
  signal?: AbortSignal;
  logger: RunLogger;
  producer: string;
  onProgress?: (event: AnalysisProgressEvent) => void;
  resumePhaseTurn?: {
    phaseTurnId: string;
    turnIndex: number;
    startedAt: number;
  };
}

export interface ExecutePhaseTurnResult {
  success: boolean;
  error?: string;
  phaseTurnId: string;
  turnIndex: number;
  summary?: PhaseSummary;
  assistantMessage: string;
}

export async function executePhaseTurn(
  phase: MethodologyPhase,
  topic: string,
  toolMcpServer: unknown,
  toolWriteContext: AnalysisWriteContext,
  context: ExecutePhaseTurnContext,
): Promise<ExecutePhaseTurnResult> {
  const input = {
    ...context,
    phase,
    topic,
    toolMcpServer,
    toolWriteContext,
  };
  const resumedPhaseTurn = input.resumePhaseTurn;
  const turnIndex =
    resumedPhaseTurn?.turnIndex ?? (input.phaseTurnCounts[input.phase] ?? 0) + 1;
  input.phaseTurnCounts[input.phase] = Math.max(
    input.phaseTurnCounts[input.phase] ?? 0,
    turnIndex,
  );
  const phaseTurnId =
    resumedPhaseTurn?.phaseTurnId ?? `phase-turn-${nanoid()}`;
  const phaseStart = resumedPhaseTurn?.startedAt ?? Date.now();
  const phaseIndex =
    input.activePhases.findIndex((phase) => phase === input.phase) + 1;
  const phaseBrief = buildPhaseBrief({
    phase: input.phase,
    topic: input.topic,
    completedPhases: input.completedPhases,
    activePhases: input.activePhases,
  });
  const phasePromptBundle = buildPhasePromptBundle({
    phase: input.phase,
    topic: input.topic,
    phaseBrief: phaseBrief.phaseBrief,
    effortLevel: input.runtime.effortLevel,
  });

  const existingBinding = getProviderSessionBinding(input.threadId, "analysis");
  const phaseTurnThread = createPhaseTurnThreadWriter({
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    runId: input.runId,
    runKind: input.runKind,
    phase: input.phase,
    phaseTurnId,
    producer: input.producer,
  });
  if (existingBinding) {
    upsertProviderSessionBinding({
      ...existingBinding,
      runId: input.runId,
      phaseTurnId,
      updatedAt: phaseStart,
    });
  }

  if (!resumedPhaseTurn) {
    appendRunEvents(
      {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        runId: input.runId,
        producer: input.producer,
      },
      [
        {
          type: "phase.started",
          payload: {
            phase: input.phase,
            phaseTurnId,
            turnIndex,
            promptProvenance: phasePromptBundle.promptProvenance,
          },
          occurredAt: phaseStart,
        },
        {
          type: "run.status.changed",
          payload: {
            status: "running",
            activePhase: input.phase,
            progress: {
              completed: input.progressCompletedBefore,
              total: input.progressTotal,
            },
            summary: buildRunSummaryState(
              `Running ${input.phase}`,
              input.progressCompletedBefore,
            ),
            latestPhaseTurnId: phaseTurnId,
          },
          occurredAt: phaseStart,
        },
      ],
    );

    phaseTurnThread.ensureUserTurn(
      buildVisiblePhaseUserMessage({
        phase: input.phase,
        phaseNumber: phaseIndex,
        objective: phaseBrief.phaseConfig.objective,
        doneCondition: phaseBrief.phaseConfig.doneCondition,
        phaseBrief: phaseBrief.phaseBrief,
      }),
      phaseStart,
    );
  }

  input.onProgress?.({
    type: "phase_started",
    phase: input.phase,
    runId: input.runId,
  });

  input.toolWriteContext.phase = input.phase;
  input.toolWriteContext.phaseTurnId = phaseTurnId;
  input.toolWriteContext.runId = input.runId;
  input.toolWriteContext.allowedEntityTypes =
    PHASE_ENTITY_TYPES[
      input.phase as keyof typeof PHASE_ENTITY_TYPES
    ] ?? [];
  input.toolWriteContext.counters = {
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    phaseCompleted: false,
  };

  beginPhaseTransaction(input.phase, input.runId);
  try {
    const toolResult = await runPhaseWithTools(
      input.phase,
      input.topic,
      input.toolMcpServer,
      input.toolWriteContext,
      {
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        promptBundle: {
          system: phasePromptBundle.system,
          user: phasePromptBundle.user,
          toolPolicy: phasePromptBundle.toolPolicy,
        },
        provider: input.provider,
        model: input.model,
        runtime: input.runtime,
        runId: input.runId,
        phaseTurnId,
        signal: input.signal,
        logger: input.logger,
        binding: existingBinding,
        allowResumeRetryFallback: !resumedPhaseTurn,
        historyMessages: existingBinding ? [] : phaseTurnThread.buildHistoryMessages(),
        onActivity: (activity) => {
          const occurredAt = Date.now();
          phaseTurnThread.recordActivity({
            kind: activity.kind,
            message: activity.message,
            toolName: activity.toolName,
            query: activity.query,
            occurredAt,
          });
          input.onProgress?.({
            type: "phase_activity",
            phase: input.phase,
            runId: input.runId,
            kind: activity.kind,
            message: activity.message,
            ...(activity.toolName ? { toolName: activity.toolName } : {}),
            ...(activity.query ? { query: activity.query } : {}),
          });
        },
      },
    );

    if (toolResult.success && toolResult.phaseCompleted) {
      const txSummary = commitPhaseTransaction(
        undefined,
        input.toolWriteContext.counters,
      );
      entityGraphService.setPhaseStatus(input.phase, "complete");
      const summary: PhaseSummary = {
        entitiesCreated: txSummary.entitiesCreated,
        entitiesUpdated: txSummary.entitiesUpdated,
        relationshipsCreated: txSummary.relationshipsCreated,
        durationMs: Date.now() - phaseStart,
      };
      const assistantMessage =
        toolResult.assistantResponse?.trim() ||
        buildFallbackAssistantSummary({
          phase: input.phase,
          summary,
        });

      phaseTurnThread.ensureAssistantTurn(assistantMessage, Date.now());

      appendRunEvents(
        {
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          runId: input.runId,
          producer: input.producer,
        },
        [
          {
            type: "phase.completed",
            payload: {
              phase: input.phase,
              phaseTurnId,
              summary,
            },
            occurredAt: Date.now(),
          },
          {
            type: "run.status.changed",
            payload: {
              status: "running",
              activePhase: null,
              progress: {
                completed: input.progressCompletedBefore + 1,
                total: input.progressTotal,
              },
              summary: buildRunSummaryState(
                `Completed ${input.phase}`,
                input.progressCompletedBefore + 1,
              ),
              latestPhaseTurnId: phaseTurnId,
            },
            occurredAt: Date.now(),
          },
        ],
      );

      input.onProgress?.({
        type: "phase_completed",
        phase: input.phase,
        runId: input.runId,
        summary,
      });

      return {
        success: true,
        phaseTurnId,
        turnIndex,
        summary,
        assistantMessage,
      };
    }

    rollbackPhaseTransaction();
    entityGraphService.setPhaseStatus(input.phase, "failed");
    const error = toolResult.error ?? "Phase did not complete";
    const assistantMessage = buildFallbackAssistantSummary({
      phase: input.phase,
      error,
    });

    phaseTurnThread.ensureAssistantTurn(assistantMessage, Date.now());
    phaseTurnThread.recordActivity({
      kind: "note",
      message: error,
      status: "failed",
      occurredAt: Date.now(),
    });
    input.onProgress?.({
      type: "phase_activity",
      phase: input.phase,
      runId: input.runId,
      kind: "note",
      message: error,
    });

    return {
      success: false,
      error,
      phaseTurnId,
      turnIndex,
      assistantMessage,
    };
  } catch (error) {
    rollbackPhaseTransaction();
    entityGraphService.setPhaseStatus(input.phase, "failed");
    const message =
      error instanceof Error ? error.message : String(error);
    const assistantMessage = buildFallbackAssistantSummary({
      phase: input.phase,
      error: message,
    });

    phaseTurnThread.ensureAssistantTurn(assistantMessage, Date.now());
    phaseTurnThread.recordActivity({
      kind: "note",
      message,
      status: "failed",
      occurredAt: Date.now(),
    });
    input.onProgress?.({
      type: "phase_activity",
      phase: input.phase,
      runId: input.runId,
      kind: "note",
      message,
    });

    return {
      success: false,
      error: message,
      phaseTurnId,
      turnIndex,
      assistantMessage,
    };
  }
}
